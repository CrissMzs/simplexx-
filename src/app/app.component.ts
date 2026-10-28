import { Component, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
 
const EPS = 1e-9;
const MAX_ITER = 50;
const SUBS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
 
const sub = (n: number): string =>
  String(n)
    .split('')
    .map((d) => SUBS[+d])
    .join('');
 
const limpiar = (x: number): number => (Math.abs(x) < 1e-10 ? 0 : x);
 
export type Fase =
  | 'inicio'
  | 'revision'
  | 'columna'
  | 'fila'
  | 'normalizar'
  | 'eliminar'
  | 'optimo'
  | 'no-acotado'
  | 'limite';
 
export interface Solucion {
  z: number;
  variables: { nombre: string; valor: number; basica: boolean }[];
}
 
export interface Frame {
  fase: Fase;
  iter: number;
  titulo: string;
  mensaje: string;
  tabla: number[][]; // m filas de restricción + fila Z; última columna = solución
  base: string[]; // etiqueta de la base por fila (última = Z)
  colPivote: number | null;
  filaPivote: number | null;
  cocientes: (number | null)[] | null;
  filasCambiadas: number[];
  negativos: number[];
  solucion?: Solucion;
}

@Component({
  selector: "app-root",
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
   // ---------- Datos de entrada ----------
  paso: 1 | 2 | 3 = 1;
  numVars = 2;
  numRest = 3;
  objetivo: number[] = [];
  A: number[][] = [];
  b: number[] = [];
  error = '';
 
  // ---------- Navegación por cuadros ----------
  frames: Frame[] = [];
  idx = 0;
 
  // ---------- Créditos ----------
  creditosAbierto = false;
  readonly githubUrl = 'https://github.com/CrissMzs';
 
  readonly etiquetasFase: Record<Fase, string> = {
    inicio: 'Tabla inicial',
    revision: 'Revisar Z',
    columna: 'Columna pivote',
    fila: 'Fila pivote',
    normalizar: 'Pivote a 1',
    eliminar: 'Ceros en la columna',
    optimo: 'Solución óptima',
    'no-acotado': 'Sin solución acotada',
    limite: 'Límite de iteraciones',
  };
 
  @HostListener('window:keydown', ['$event'])
  teclas(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.creditosAbierto) {
      this.cerrarCreditos();
      return;
    }
    if (this.paso !== 3 || this.creditosAbierto) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.siguiente();
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.anterior();
    }
  }
 
  // ---------- Créditos ----------
  abrirCreditos(): void {
    this.creditosAbierto = true;
  }
  cerrarCreditos(): void {
    this.creditosAbierto = false;
  }
 
  abrirGithub(e: Event): void {
    const tauri = (window as any).__TAURI__;
    const abrir = tauri?.opener?.openUrl ?? tauri?.shell?.open;
    if (abrir) {
      e.preventDefault();
      abrir(this.githubUrl);
    }
  }
 
  // ---------- Nombres ----------
  get nombresX(): string[] {
    return Array.from({ length: this.numVars }, (_, j) => 'x' + sub(j + 1));
  }
  get nombresH(): string[] {
    return Array.from({ length: this.numRest }, (_, i) => 'h' + sub(i + 1));
  }
  get colNames(): string[] {
    return [...this.nombresX, ...this.nombresH];
  }
 
  porIndice = (i: number): number => i;
 
  // ---------- Formato ----------
  fmt(n: number): string {
    let r = Number(n.toFixed(4));
    if (Object.is(r, -0)) r = 0;
    return String(r).replace('-', '−');
  }
 
  private termino(coef: number, nombre: string): string {
    const abs = Math.abs(coef);
    const c = abs === 1 && nombre ? '' : this.fmt(abs);
    return coef < 0 ? ` − ${c}${nombre}` : ` + ${c}${nombre}`;
  }
 
  private limpiarSigno(s: string): string {
    s = s.trim();
    if (s.startsWith('+ ')) return s.slice(2);
    if (s.startsWith('− ')) return '−' + s.slice(2);
    return s;
  }
 
  /** Z − c₁x₁ − c₂x₂ + 0h₁ + … = 0 */
  get ecuacionZ(): string {
    let s = 'Z';
    this.nombresX.forEach((x, j) => {
      s += this.termino(0 - (Number(this.objetivo[j]) || 0), x);
    });
    this.nombresH.forEach((h) => {
      s += ` + 0${h}`;
    });
    return s + ' = 0';
  }
 
  ecuacionRestriccion(i: number): string {
    let s = '';
    this.nombresX.forEach((x, j) => {
      s += this.termino(Number(this.A[i]?.[j]) || 0, x);
    });
    s += ` + ${this.nombresH[i]}`;
    return this.limpiarSigno(s) + ' = ' + this.fmt(Number(this.b[i]) || 0);
  }
 
  // ---------- Navegación entre pasos ----------
  private entero(v: unknown, min: number, max: number, def: number): number {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, n));
  }
 
  irADatos(): void {
    const n = (this.numVars = this.entero(this.numVars, 1, 8, 2));
    const m = (this.numRest = this.entero(this.numRest, 1, 8, 2));
    this.objetivo = Array.from({ length: n }, (_, j) => this.objetivo[j] ?? 0);
    this.A = Array.from({ length: m }, (_, i) =>
      Array.from({ length: n }, (_, j) => this.A[i]?.[j] ?? 0)
    );
    this.b = Array.from({ length: m }, (_, i) => this.b[i] ?? 0);
    this.error = '';
    this.paso = 2;
  }
 
  cargarEjemplo(): void {
    this.numVars = 2;
    this.numRest = 3;
    this.objetivo = [3, 5];
    this.A = [
      [1, 0],
      [0, 2],
      [3, 2],
    ];
    this.b = [4, 12, 18];
    this.irADatos();
  }
 
  volver(): void {
    this.error = '';
    this.paso = this.paso === 3 ? 2 : 1;
  }
 
  /** Descarta todo y regresa al paso 1 (Tamaño). */
  cancelar(): void {
    this.frames = [];
    this.idx = 0;
    this.objetivo = [];
    this.A = [];
    this.b = [];
    this.error = '';
    this.paso = 1;
  }
 
  resolver(): void {
    const c = this.objetivo.map((v) => Number(v) || 0);
    const A = this.A.map((f) => f.map((v) => Number(v) || 0));
    const b = this.b.map((v) => Number(v) || 0);
 
    if (b.some((v) => v < 0)) {
      this.error =
        'El lado derecho de cada restricción debe ser mayor o igual a 0 para que las variables de holgura formen la base inicial.';
      return;
    }
    if (c.every((v) => v === 0)) {
      this.error = 'Escribe al menos un coeficiente distinto de cero en Z.';
      return;
    }
    this.objetivo = c;
    this.A = A;
    this.b = b;
    this.error = '';
    this.frames = this.generarFrames();
    this.idx = 0;
    this.paso = 3;
  }
 
  // ---------- Reproductor ----------
  get frame(): Frame {
    return this.frames[this.idx];
  }
  get esUltimo(): boolean {
    return this.idx >= this.frames.length - 1;
  }
  get totalIteraciones(): number {
    return this.frames[this.frames.length - 1]?.iter ?? 0;
  }
 
  siguiente(): void {
    if (this.idx < this.frames.length - 1) this.idx++;
  }
  anterior(): void {
    if (this.idx > 0) this.idx--;
  }
  ir(valor: number | string): void {
    this.idx = Math.min(this.frames.length - 1, Math.max(0, Number(valor) || 0));
  }
 
  // ---------- Clases de celda (animaciones) ----------
  clasesCelda(f: Frame, i: number, j: number, v: number): Record<string, boolean> {
    const m = this.numRest;
    const ncols = this.numVars + this.numRest;
    const esZ = i === m;
    const cambiada = f.filasCambiadas.includes(i);
    const hayPivote = f.colPivote !== null && f.filaPivote !== null;
    return {
      'col-pivote': f.colPivote === j,
      'fila-pivote': f.filaPivote === i,
      pivote: hayPivote && f.colPivote === j && f.filaPivote === i,
      pop: f.fase === 'fila' && f.colPivote === j && f.filaPivote === i,
      neg: esZ && j < ncols && v < -EPS,
      pulso: f.fase === 'revision' && esZ && f.negativos.includes(j),
      sol: j === ncols,
      'flash-a': cambiada && this.idx % 2 === 0,
      'flash-b': cambiada && this.idx % 2 === 1,
    };
  }
 
  // ---------- Motor simplex: genera todos los cuadros ----------
  private generarFrames(): Frame[] {
    const n = this.numVars;
    const m = this.numRest;
    const ncols = n + m;
    const nombres = this.colNames;
 
    // Tabla: m restricciones + fila Z (Z − c·x = 0 → coeficientes −c)
    const t: number[][] = [];
    for (let i = 0; i < m; i++) {
      t.push([
        ...this.A[i],
        ...Array.from({ length: m }, (_, k) => (k === i ? 1 : 0)),
        this.b[i],
      ]);
    }
    t.push([...this.objetivo.map((c) => 0 - c), ...new Array(m).fill(0), 0]);
 
    const base: string[] = [...this.nombresH, 'Z'];
    const frames: Frame[] = [];
    let iter = 0;
 
    const push = (
      f: Pick<Frame, 'fase' | 'titulo' | 'mensaje'> & Partial<Frame>
    ): void => {
      frames.push({
        iter,
        tabla: t.map((r) => [...r]),
        base: [...base],
        colPivote: null,
        filaPivote: null,
        cocientes: null,
        filasCambiadas: [],
        negativos: [],
        ...f,
      });
    };
 
    const solucion = (): Solucion => ({
      z: t[m][ncols],
      variables: nombres.map((nombre) => {
        const i = base.indexOf(nombre);
        return { nombre, valor: i >= 0 ? t[i][ncols] : 0, basica: i >= 0 };
      }),
    });
 
    push({
      fase: 'inicio',
      titulo: 'Tabla inicial',
      mensaje:
        'Igualamos Z a cero y sumamos una variable de holgura con coeficiente 0 en Z por cada restricción. Las holguras forman la base inicial.',
    });
 
    while (true) {
      iter++;
      const z = t[m];
      const negativos: number[] = [];
      for (let j = 0; j < ncols; j++) if (z[j] < -EPS) negativos.push(j);
 
      // 1) ¿Todos los coeficientes de Z son ≥ 0?
      if (negativos.length === 0) {
        iter--;
        push({
          fase: 'optimo',
          titulo: 'Solución óptima',
          mensaje: `Todos los coeficientes de Z son mayores o iguales a cero. El valor máximo es Z = ${this.fmt(
            t[m][ncols]
          )}.`,
          solucion: solucion(),
        });
        break;
      }
 
      if (iter > MAX_ITER) {
        iter--;
        push({
          fase: 'limite',
          titulo: 'Límite de iteraciones',
          mensaje: `Se alcanzaron ${MAX_ITER} iteraciones sin llegar al óptimo. Es posible que el problema esté ciclando.`,
        });
        break;
      }
 
      push({
        fase: 'revision',
        titulo: `Iteración ${iter}: revisar Z`,
        mensaje: `Hay coeficientes negativos en Z (${negativos
          .map((j) => `${nombres[j]} = ${this.fmt(z[j])}`)
          .join(', ')}). La solución todavía no es óptima, continuamos.`,
        negativos,
      });
 
      // 2) Columna pivote: el coeficiente más negativo
      let pc = negativos[0];
      for (const j of negativos) if (z[j] < z[pc]) pc = j;
      push({
        fase: 'columna',
        titulo: `Iteración ${iter}: columna pivote`,
        mensaje: `El coeficiente más negativo es ${this.fmt(z[pc])}, de ${nombres[pc]}. Esa es la columna pivote.`,
        colPivote: pc,
      });
 
      // 3) Fila pivote: solución ÷ columna, solo cocientes positivos
      const cocientes: (number | null)[] = Array.from({ length: m }, (_, i) =>
        t[i][pc] > EPS ? t[i][ncols] / t[i][pc] : null
      );
      let pr = -1;
      cocientes.forEach((v, i) => {
        if (v !== null && (pr === -1 || v < (cocientes[pr] as number) - EPS)) pr = i;
      });
 
      if (pr === -1) {
        push({
          fase: 'no-acotado',
          titulo: 'Sin solución acotada',
          mensaje: `Ningún elemento de la columna de ${nombres[pc]} es positivo, así que no hay cociente válido. Z puede crecer sin límite: el problema no está acotado.`,
          colPivote: pc,
          cocientes,
        });
        break;
      }
 
      push({
        fase: 'fila',
        titulo: `Iteración ${iter}: fila pivote`,
        mensaje: `Dividimos la solución entre cada elemento de la columna. Se descartan los negativos y los ceros. El menor cociente positivo es ${this.fmt(
          cocientes[pr] as number
        )}, en la fila de ${base[pr]}. El pivote es ${this.fmt(t[pr][pc])}.`,
        colPivote: pc,
        filaPivote: pr,
        cocientes,
      });
 
      // 4) Pivote → 1 (dividir la fila pivote)
      const p = t[pr][pc];
      t[pr] = t[pr].map((v) => limpiar(v / p));
      base[pr] = nombres[pc];
      push({
        fase: 'normalizar',
        titulo: `Iteración ${iter}: pivote a 1`,
        mensaje: `Dividimos toda la fila pivote entre ${this.fmt(p)}. ${nombres[pc]} entra a la base y sale la holgura o variable de esa fila.`,
        colPivote: pc,
        filaPivote: pr,
        filasCambiadas: [pr],
      });
 
      // 5) Ceros en el resto de la columna pivote
      for (let i = 0; i <= m; i++) {
        if (i === pr) continue;
        const factor = t[i][pc];
        if (Math.abs(factor) < EPS) continue;
        t[i] = t[i].map((v, j) => limpiar(v - factor * t[pr][j]));
        t[i][pc] = 0;
        push({
          fase: 'eliminar',
          titulo: `Iteración ${iter}: ceros en la columna`,
          mensaje: `Fila ${base[i]} ← fila ${base[i]} ${factor > 0 ? '−' : '+'} ${this.fmt(
            Math.abs(factor)
          )} × fila ${base[pr]}. El elemento de ${nombres[pc]} queda en 0.`,
          colPivote: pc,
          filaPivote: pr,
          filasCambiadas: [i],
        });
      }
    }
 
    return frames;
  }
}
