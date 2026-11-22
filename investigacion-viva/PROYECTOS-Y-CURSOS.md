# Investigación Viva — áreas, proyectos y puertas de entrada

Este documento define la evolución editorial de Investigación Viva. Su función no es reemplazar los dossiers privados ni publicar sus contenidos: el catálogo personal, las notas y el seguimiento permanecen protegidos por Supabase y sus políticas RLS.

## 1. Arquitectura del catálogo

Cada proyecto pertenece a un área principal:
- Ciencia y conocimiento
- Religión y misticismo
- Pensamiento y filosofía
- Universos de ficción
- Pueblos y culturas
- Literatura
- Historia
- Arte y música
- Otros proyectos

Un proyecto puede tener subproyectos. Se conserva la jerarquía existente (hasta tres niveles) y el orden manual entre hermanos.

Los metadatos de clasificación se guardan en `iv_project_index.data.items[]`:
- `area`: código del área principal.
- `status`: `pending`, `active` o `done`.
- `archived`: `true` o `false`, independiente del estado.
- `archivedAt`: fecha ISO del archivo, o `null`.
- `parentId`: relación jerárquica.

Los registros existentes se normalizan sin migración destructiva: los dossiers conocidos reciben un área inicial; los demás entran en «Otros proyectos» hasta su clasificación.

## 2. Página de cada proyecto: la puerta de entrada

Cada proyecto debe funcionar como un pequeño espacio de estudio. Su portada, cuando exista, tendrá:

1. **Empezar por acá**. Una presentación breve con preguntas orientadoras, nivel de entrada y mapa del tema.
2. **Minicurso de introducción**. Preferentemente entre 6 y 10 lecciones originales, como el curso de Emily Dickinson en Edición Viva. Cada lección tendrá un propósito, una exposición sustantiva, ejemplos o fuentes, actividades de comprobación y enlaces para ampliar.
3. **Lecturas y fuentes**. Bibliografía selectiva y primaria; separar material original, traducciones propias, crítica y consulta complementaria.
4. **Atlas y material visual**. Grabados, mapas, cronologías, galerías, diagramas o simulaciones cuando aporten valor, con procedencia.
5. **Cuaderno de investigación**. Preguntas, hipótesis, notas y tareas abiertas; diferenciar lo verificado de lo provisional.
6. **Resultados o síntesis**. Conclusiones revisables, hallazgos, mapas de conceptos y conexiones con otros proyectos.

El minicurso no es un simple listado de lecturas ni debe sustituirse por una sucesión de fichas breves. Su objetivo es ofrecer un **recorrido pedagógico autónomo** antes de la profundización documental.

## 3. Progreso

El proyecto y cada minicurso tienen progresos distintos: terminar las lecciones introductorias no equivale a completar la investigación. Deben mostrarse por separado cuando existan contenidos reales.

Nunca se presenta un minicurso como disponible sin lecciones publicadas y navegables. Las futuras páginas de contenido tendrán una estructura compartida de presentación, navegación anterior/siguiente, seguimiento de progreso, notas y referencias.

## 4. Archivo

- **Terminado** (`status=done`) significa que concluyó el trabajo previsto; sigue en el catálogo activo.
- **Archivar** (`archived=true`) lo retira del catálogo principal y de los dossiers destacados, pero no elimina sus datos, vínculos, lecciones, imágenes, fuentes ni tiempo registrado.
- Solo pueden archivarse proyectos marcados como terminados. Si tienen subproyectos, estos deben estar terminados también; se archivan en conjunto.
- **Restaurar** devuelve el proyecto (y sus subproyectos) al catálogo principal sin perder datos ni modificar su estado de finalización.
- El archivo posee su propia sección agrupada por áreas, con acceso de consulta a los dossiers existentes.

Se evita cualquier borrado automático. La acción «Eliminar proyecto» del índice, cuando proceda, permanece separada del archivo.

## 5. Privacidad y publicación

Investigación Viva es un espacio personal detrás de la cuenta compartida con Palabra Viva y Edición Viva. La aplicación pública de GitHub Pages contiene código de presentación y estructura genérica; los datos privados no deben volcarse al HTML, JS, documentación o historial público del repositorio.

El catálogo y sus materiales se cargan después de autenticar, mediante RLS. Los enlaces a dossiers deben limitarse a rutas existentes y permitidas. No crear enlaces rotos ni aparentar que se ha publicado contenido aún por preparar.

**Siguiente etapa editorial:** desarrollar y probar un minicurso completo asociado a un proyecto antes de replicar el patrón por todas las áreas.
