# Palabra Viva

**Palabra Viva** es el portal común de proyectos independientes vinculados con las lenguas, los textos y la investigación.

**Sitio:** https://ignacioaragues.github.io/palabra-viva/

## Proyectos

- **[Lengua Viva](https://ignacioaragues.github.io/lingua-viva/)** — plataforma de aprendizaje de idiomas. Su nombre visible es *Lengua Viva*, aunque la ruta pública existente sigue siendo `/lingua-viva/` para preservar enlaces y configuraciones de autenticación.
- **[Edición Viva](https://ignacioaragues.github.io/edicion-viva/)** — biblioteca de ediciones bilingües y anotadas.
- **Investigación Viva** — proyecto en preparación para publicaciones, cuadernos de investigación, dossiers y otras actividades de investigación. No se anuncia todavía como disponible.

Cada proyecto conserva su repositorio, sitio, estructura y herramientas. Palabra Viva no traslada datos personales ni modifica los sistemas de cuentas, seguimiento o lectura.

## Arquitectura

Sitio estático sin dependencias de compilación:

- `index.html`: portada, navegación, proyectos y presentación.
- `styles.css`: sistema visual editorial, responsive y estados accesibles.
- `favicon.svg`: identidad básica del sitio.

El diseño sigue una familia visual compartida con Edición Viva y Lengua Viva: papel claro, verde oscuro, tipografía serif y una navegación sobria.

## Publicación

GitHub Pages: **Settings → Pages → Build and deployment → Deploy from a branch → main / (root)**.

La dirección prevista es https://ignacioaragues.github.io/palabra-viva/. Las actualizaciones de la rama principal se publican mediante GitHub Pages si este está habilitado.

## Próximos proyectos

Para habilitar un proyecto nuevo:

1. Verificar que su sitio o contenido esté efectivamente disponible.
2. Agregar o actualizar una tarjeta en `index.html`.
3. Vincularla a una URL real y actualizar su estado visible.
4. Mantener operativos los proyectos ya enlazados.

No es necesario modificar los repositorios de Lengua Viva o Edición Viva para agregar un nuevo espacio al portal.
