# Método Simplex

Aplicación de escritorio para resolver problemas de programación lineal con el método simplex, mostrando cada paso de forma animada. Está hecha con Angular y Tauri.

## Descripción

Este programa resuelve problemas de **maximización** con restricciones del tipo menor o igual (≤). En lugar de dar solo el resultado, enseña el proceso completo: arma la tabla inicial, elige la columna y la fila pivote, hace ceros y repite hasta llegar a la solución óptima.

Es útil para estudiar el método, revisar tareas o entender por qué el simplex llega a cierto resultado.

## Qué hace

1. Pide el número de variables de decisión y el número de restricciones. Las condiciones de no negatividad (x ≥ 0) no se piden porque se asumen.
2. Pide los coeficientes de Z y de cada restricción.
3. Iguala Z a cero y agrega una variable de holgura por cada restricción (h₁, h₂, h₃, ...) con coeficiente cero en Z.
4. Arma la tabla inicial.
5. Revisa los coeficientes de Z:
   - Si todos son mayores o iguales a cero, la solución es óptima.
   - Si hay negativos, continúa.
6. Elige la **columna pivote**: la del coeficiente más negativo en Z.
7. Elige la **fila pivote**: divide la columna Solución entre cada elemento de la columna pivote. Se ignoran los cocientes negativos y las divisiones entre cero. Gana el menor cociente positivo.
8. Convierte el pivote en 1 y hace ceros en el resto de la columna pivote.
9. Vuelve al paso 5 y repite hasta terminar.

Al final muestra el valor máximo de Z y el valor de cada variable.

## Cómo se usa

1. En **Tamaño**, escribe cuántas variables y cuántas restricciones tiene tu problema. También puedes pulsar **Cargar ejemplo**.
2. En **Datos**, escribe los coeficientes. Debajo verás la forma estándar con las variables de holgura.
3. Pulsa **Resolver**.
4. En **Solución**, avanza o retrocede por los pasos con los botones de flecha o con las flechas izquierda y derecha del teclado. También puedes usar la barra para saltar a cualquier paso.

Puedes pulsar **Cancelar** en cualquier momento para borrar todo y volver al primer paso, o **Editar datos** para corregir los números sin perderlos.

## Ejemplo

Maximizar Z = 3x₁ + 5x₂ sujeto a:

```
x₁            ≤  4
      2x₂     ≤ 12
3x₁ + 2x₂     ≤ 18
```

Resultado esperado: x₁ = 2, x₂ = 6 y Z = 36.

## Limitaciones

- Solo resuelve problemas de maximización.
- Solo acepta restricciones del tipo ≤ con el lado derecho mayor o igual a cero. No incluye el método de dos fases ni Big M.
- Permite hasta 8 variables y 8 restricciones.
- Los números se muestran con hasta 4 decimales, no como fracciones.
- Si el problema no está acotado, o si no converge en 50 iteraciones, el programa lo indica.

## Estructura de los archivos

```
simplex/
  simplex.component.ts     Lógica del simplex y control de la pantalla
  simplex.component.html   Estructura de la interfaz
  simplex.component.css    Estilos y animaciones
  README.md                Este archivo
```

## Instalación en un proyecto Tauri con Angular

1. Copia la carpeta `simplex` dentro de `src/app/`.
2. Importa el componente. Es standalone, así que se agrega directamente:

   ```ts
   import { SimplexComponent } from './simplex/simplex.component';

   @Component({
     selector: 'app-root',
     standalone: true,
     imports: [SimplexComponent],
     template: '<app-simplex />',
   })
   export class AppComponent {}
   ```

3. Si tu proyecto usa módulos (NgModule), declara el componente y asegúrate de importar `FormsModule` y `CommonModule`.
4. Ejecuta la aplicación:

   ```bash
   npm install
   npm run tauri dev
   ```

No necesita conexión a internet ni dependencias extra. Las animaciones son CSS y las fuentes son las del sistema.

Desarrollado por **CrissMzs**.

GitHub: [github.com/CrissMzs](https://github.com/CrissMzs)