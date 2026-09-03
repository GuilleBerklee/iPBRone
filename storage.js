export const DB_NAME = 'PBRScannerDB';
export const STORE_NAME = 'projects';

export function initDB() {
  return new PromisePara gestionar proyectos, asignarles un nombre y habilitar exportaciones en un dispositivo móvil, el enfoque más práctico es estructurar el estado de tu aplicación y guardarlo en el almacenamiento interno.

**Modelo de Datos del Proyecto**
Necesitas definir una estructura (clase o interfaz) que centralice toda la información. Cuando el usuario guarda, serializas esto; cuando abre, lo deserializas.

*   `id`: Identificador único (UUID) para evitar conflictos de nombres.
*   `nombre`: El nombre que introduce el usuario (ej. "Mi_Diseño_01").
*   `fechaModificacion`: Para ordenar la lista en la pantalla de la librería.
*   `datos`: Un objeto con el estado real de tu trabajo (capas, configuraciones, textos, etc.).

**Opciones de Almacenamiento Local**

| Método | Casos de uso | Ventajas |
| :--- | :--- | :--- |
| **Archivos JSON** (Directorio de App) | Proyectos independientes, fáciles de exportar o respaldar en la nube. | Muy fácil de implementar; guardar el estado completo es tan simple como escribir un archivo de texto. |
| **Base de Datos local** (SQLite, Realm, Hive) | Librerías masivas donde el usuario necesita buscar o filtrar proyectos por nombre. | Lecturas más rápidas al cargar la pantalla inicial de la librería. |

*Recomendación:* Si el estado del proyecto es complejo o jerárquico, guardar cada proyecto como un archivo `.json` independiente en el directorio de documentos de la app suele ser la solución más directa.

**Flujo de la Librería**
1.  **Listar:** Al entrar a la app, lees la carpeta de documentos. Abres cada archivo guardado, extraes solo el `nombre` y `fechaModificacion`, y construyes la interfaz de tu librería.
2.  **Cargar:** Al tocar un proyecto, lees el archivo completo, pasas los `datos` a la memoria de la aplicación y abres el editor.
3.  **Guardar:** Usas el `id` del proyecto como nombre físico del archivo (ej. `550e8400.json`) para que el usuario pueda cambiar el título del proyecto sin romper la ruta de guardado.

**Exportación**
Cuando el usuario pulsa "Exportar", tomas la variable `nombre` de tu modelo y la sanitizas (reemplazando espacios por guiones y eliminando caracteres especiales). Luego, concatenas la extensión final (por ejemplo, `Mi_Diseno_01.mp4`) y utilizas las APIs del sistema nativo para guardar ese archivo en una carpeta pública, como Descargas o la Galería.

¿En qué tecnología o framework estás desarrollando la app (Flutter, React Native, Kotlin, Swift) para poder proporcionarte la librería exacta de sistema de archivos que necesitas implementar?