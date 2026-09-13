# Task: Build Website Homepage for throughmylens.icu

You are implementing the first production-quality page of a personal photography portfolio website.

This task is limited to the homepage.

Do not build the remaining full pages yet.

The homepage will establish the permanent visual language for the rest of the website, so implementation quality, spacing, typography, image behavior and motion are more important than quickly adding many features.

Before writing code:

1. Read `DESIGN.md` completely.
2. Inspect the existing project structure.
3. Inspect any supplied photography assets and design references.
4. Reuse the current technology stack rather than replacing it without a strong reason.
5. Preserve existing working infrastructure.
6. Do not introduce a generic template or component-library aesthetic.

The homepage should become the visual baseline for all later pages.

---

# 1. Homepage Goal

The homepage is a visual entry point.

It should guide visitors toward deeper sections without trying to display the entire photography archive.

The homepage should feel:

* quiet
* immersive
* restrained
* cinematic
* editorial
* carefully curated

Photography must remain the dominant visual element.

The interface should remain subtle.

Do not add marketing copy, slogans or generic portfolio language.

---

# 2. Required Homepage Structure

Implement the homepage in exactly this high-level order:

1. Header / navigation
2. Fullscreen Hero slideshow
3. Selected Work
4. Selected Projects
5. Places
6. Footer

Do not add unrelated sections.

Do not add a Films homepage section at this stage.

Films remains accessible through the navigation.

---

# 3. Header

Create a minimal header.

Left side:

SHEPS.LOG

Right side:

Work
Projects
Films
Places
About

The navigation should remain elegant and visually lightweight.

Do not use:

* buttons
* pills
* icons beside every item
* large borders
* large navigation containers
* heavy shadows
* glassmorphism

Desktop layout should feel precise and spacious.

The header may overlay the hero photography.

If the header overlays the photograph, ensure readability against both bright and dark images.

Possible approaches include:

* carefully controlled text color
* dynamic light/dark treatment
* a very subtle local contrast solution

Do not place an obvious opaque navigation bar over the hero unless absolutely necessary.

The visual preference is for the navigation to feel integrated with the photography.

Use subtle hover states.

---

# 4. Hero Slideshow

The first viewport should be dominated entirely by photography.

There must be:

* no slogan
* no description
* no CTA
* no project title
* no hero text
* no button
* no visible carousel dots by default

The hero should use several manually selected photographs.

Prepare the implementation so that hero image order can eventually come from backend/CMS data.

For now, if backend data does not yet exist, create a clean data structure for the hero images.

Example conceptual data:

* image source
* alt text
* order
* focal position

Do not hard-code layout logic separately for each photograph.

---

## Hero Sizing

Desktop:

The hero should approximately fill the viewport.

Use visual judgment regarding whether the header is included inside the viewport height.

The photograph must feel immersive.

Mobile:

The hero must still feel intentional.

Do not simply use the exact same crop as desktop.

Respect focal points.

---

## Hero Transition

Use a seamless crossfade.

Recommended target:

* each image visible approximately 6–8 seconds
* crossfade approximately 1.2–1.8 seconds

The transition should feel calm.

Do not use horizontal sliding.

Do not use dramatic movement.

Avoid obvious zoom effects in the first implementation.

If you experiment with any scale motion, it must be nearly imperceptible.

Crossfade is the primary effect.

---

## Hero Loading

Preload the next required image so transitions never reveal blank frames or image loading flashes.

Do not preload the entire website gallery.

Optimize only what is necessary for the hero experience.

---

# 5. Transition From Hero to Content

Scrolling from the hero into the main page should feel natural.

Do not use decorative section separators.

Do not introduce large colored blocks.

The transition should be based primarily on:

* whitespace
* background
* typography
* photographic rhythm

The primary page background after the hero should be white or subtly warm white.

---

# 6. Selected Work Section

Add a restrained section header.

Preferred structure:

Selected Work                                      Explore Work →

`Explore Work →` should eventually navigate to `/work`.

The typography should remain small and controlled.

Do not create a large marketing heading.

---

# 7. Selected Work Continuous Gallery

Create a single horizontal continuous photographic strip.

Requirements:

* moves from right to left automatically
* loops infinitely
* no visible loop jump
* no gap between images
* contains both landscape and portrait images
* preserves each image's original aspect ratio
* images share a consistent visible height
* no border radius
* no shadows
* no cards
* no separator lines

The strip should feel like a continuous photographic sequence.

It must not resemble:

* a conventional carousel
* a logo marquee
* Pinterest
* a card slider

---

## Selected Work Motion

Move very slowly.

The motion should almost disappear into the background.

Target approximately:

20–35 seconds for imagery to travel one viewport width.

Do not mechanically use this number if it looks wrong.

Visually tune it.

The visitor should first notice the photographs, then gradually notice that the gallery is moving.

---

## Desktop Interaction

When the mouse enters the Selected Work gallery:

Pause automatic movement.

Allow click-and-drag horizontal navigation.

Dragging should feel smooth and direct.

When the user releases and stops interacting:

Resume automatic movement naturally.

Do not snap aggressively between images.

Do not show a scrollbar.

---

## Mobile Interaction

Allow native-feeling horizontal swipe.

The visitor should be able to manually move the strip.

After interaction finishes, slow automatic movement may resume.

Avoid fighting against the user's swipe.

---

# 8. Image Metadata Interaction

Implement reusable image metadata interaction so the same component can later be reused elsewhere.

Metadata is hidden by default.

---

## Desktop

On mouse hover over a photograph:

First reveal:

Location · Date

Example:

Harbin, China · January 2026

Then, after a slight delay, reveal:

Focal length · Aperture · Shutter · ISO

Example:

50mm · f/4 · 1/320s · ISO 100

Use staggered fade timing.

Suggested starting point:

Location/date:
approximately 150–250 ms delay

Camera parameters:
another approximately 150–250 ms later

Tune visually.

---

## Mouse Leave

Fade camera parameters first.

Then fade location/date shortly afterward.

Do not abruptly remove everything simultaneously.

---

## Metadata Styling

Position metadata near the lower-left area of the photograph.

Use small typography.

Location/date should be more visually prominent than technical parameters.

Technical parameters should use reduced opacity.

If contrast is insufficient:

Use a subtle local bottom gradient.

Do not apply a strong black overlay over the whole image.

The photograph must not noticeably change color simply because the user hovers.

---

# 9. Fullscreen Viewer — Desktop

Clicking a photograph should open a fullscreen viewer.

Do not implement a generic abrupt modal lightbox.

Create a smooth image-expansion interaction.

Desired visual sequence:

1. user clicks image
2. surrounding background gradually darkens
3. the existing image visually expands from its position
4. it moves smoothly toward the viewport center
5. fullscreen image state is reached

Aim for approximately:

300–450 ms

Tune visually.

The transition should feel spatially continuous.

Closing should reverse the animation where technically practical.

Support:

* click close control
* Escape key
* clicking outside where appropriate

Keep the viewer itself extremely minimal.

Do not add unnecessary chrome.

---

# 10. Mobile Image Interaction

Mobile interaction differs intentionally from desktop.

Single tap:

Reveal metadata.

Second tap:

Hide metadata.

Long press:

Enter fullscreen viewer.

Use approximately:

400–500 ms

as the starting long-press threshold.

Provide subtle visual acknowledgement during the press.

Do not make the photograph look like a button.

Avoid aggressive scaling.

---

# 11. First-Time Mobile Interaction Hint

Implement a lightweight first-use hint.

Suggested text:

Tap for details · Hold to view

Requirements:

* appears subtly
* remains visible only briefly
* fades automatically
* does not repeatedly interrupt users
* can use local storage or equivalent client-side persistence so it is not shown every visit

Do not use a modal onboarding flow.

Do not block the image.

---

# 12. Selected Projects Section

After Selected Work, create generous whitespace.

Selected Projects should feel clearly different from the moving Work gallery.

Use approximately 2–3 featured projects.

Each project should contain:

* large cover photograph
* title
* year
* optional extremely short descriptor if genuinely useful

Do not use cards with rounded containers.

Do not create small repeated tiles.

Projects should feel like photography-book covers or exhibition entries.

Possible visual rhythm:

Large project cover

Qilian Mountains
2026

then whitespace,

then another project.

The page does not need to force all project items into a perfectly identical grid.

Editorial variation is allowed if it improves the visual rhythm.

Each project should eventually navigate to:

`/projects/[slug]`

Add a restrained:

Explore Projects →

link.

---

# 13. Places Section

Create the homepage Places preview beneath Selected Projects.

The purpose is to communicate that the photography can also be explored geographically.

The primary navigation already contains Places, but the homepage section should visually introduce the idea.

---

## Places Map

Use a visually minimal map treatment.

The map should not resemble a navigation application.

Avoid:

* excessive controls
* large zoom widgets
* route UI
* heavy default map styling
* unnecessary map labels

Prefer:

* restrained map outlines
* subtle markers
* minimal labels
* neutral colors

The map should fit naturally into the photography site's visual language.

---

## Place Interaction

Where technically feasible:

Hovering a marker on desktop may reveal:

* place name
* small image preview

Clicking should eventually lead to the relevant place view.

Mobile should use tap.

Do not over-engineer the map in this homepage task.

The homepage map is a preview.

The complete geographic browsing experience will be designed later on `/places`.

Add:

Explore Places →

---

# 14. Footer

Keep the footer very simple.

Possible contents:

Instagram
Email
© SHEPS.LOG / current year

Do not create:

* newsletter CTA
* large logo section
* multi-column enterprise footer
* repeated navigation unless visually justified
* social icon wall

The page should end quietly.

---

# 15. Responsive Rules

Design at minimum for:

* large desktop
* laptop
* tablet
* mobile portrait

Do not treat mobile as desktop stacked vertically.

Explicitly inspect:

* hero crop
* navigation spacing
* Selected Work strip height
* portrait photograph width
* metadata placement
* project covers
* Places section
* footer spacing

Mobile should remain photography-first.

---

# 16. Navigation on Mobile

Use a minimal mobile navigation pattern.

Do not squeeze all five links into an unusable single line.

A restrained menu is acceptable.

The mobile menu should contain:

Work
Projects
Films
Places
About

Avoid heavy full-screen animated menu effects unless they genuinely improve usability.

Keep interaction simple and elegant.

---

# 17. Accessibility

Implement:

* semantic navigation
* meaningful alt text support
* keyboard-accessible links
* keyboard support for fullscreen viewer
* Escape to close fullscreen
* visible but restrained focus states
* appropriate text contrast

Respect:

`prefers-reduced-motion`

When reduced motion is enabled:

* disable continuous Selected Work auto-motion, or provide a calm static/manual version
* simplify hero transitions
* simplify fullscreen animation

Do not remove functionality.

---

# 18. Performance

Photography assets are large, so image handling must be intentional.

Use the framework's best available image optimization strategy.

Requirements:

Hero:

* preload the current image
* prepare the next image
* avoid blank transition frames

Below the fold:

* lazy load appropriately

Gallery:

* do not load original full-resolution files if smaller responsive images are sufficient
* fullscreen may load a larger image on demand

Avoid unnecessary JavaScript for simple styling.

Do not load a huge animation library solely for trivial fades unless the project already uses it.

---

# 19. Code Structure

Do not place the entire homepage into one huge component.

Create reusable concepts where appropriate, for example:

* Header
* HeroSlideshow
* SelectedWorkStrip
* PhotographyImage
* ImageMetadata
* FullscreenViewer
* SelectedProjects
* PlacesPreview
* Footer

Names may differ depending on the existing architecture.

Keep content/data separate from presentational logic where practical.

Avoid premature abstraction.

---

# 20. Content Data

Where actual backend data is not yet available, use structured mock data.

Do not scatter hard-coded image information throughout JSX/templates.

Photography data should support fields such as:

* id
* src
* alt
* width
* height
* location
* country
* date
* focalLength
* aperture
* shutterSpeed
* iso
* featured
* order
* focalPosition

Only use fields actually needed by the homepage.

Prepare architecture so future backend integration is straightforward.

---

# 21. Anti-Template Rules

This section is mandatory.

Do not introduce:

* gradients
* glassmorphism
* large rounded cards
* glowing UI
* startup-style hero copy
* badges
* icon-heavy navigation
* decorative blobs
* random geometric backgrounds
* testimonial sections
* statistics
* large CTA buttons
* generic text such as "Capturing moments that matter"
* large typography simply to fill space
* strong parallax
* exaggerated hover scaling
* every section placed in a rounded box

The result must not look like an AI-generated portfolio template.

If the rendered result looks like a common Framer/Webflow portfolio theme, revise it.

---

# 22. Visual Review Process

Do not stop after the code compiles.

After implementation:

1. run the development server
2. open the homepage
3. inspect desktop rendering
4. inspect mobile rendering
5. take screenshots if your environment supports it
6. compare the result against `DESIGN.md`
7. identify visual problems
8. revise them
9. inspect again

Specifically inspect:

* whether photographs dominate
* whether header feels too strong
* hero crop quality
* slideshow transition smoothness
* Selected Work speed
* Selected Work loop seam
* hover pause behavior
* drag/swipe quality
* metadata timing
* metadata readability
* fullscreen animation
* Selected Projects spacing
* Places visual weight
* footer restraint
* mobile interaction quality
* overall page rhythm

---

# 23. Self-Critique Before Completion

Before declaring the task finished, answer internally:

1. Does this look like a serious photographer's website?
2. Is anything visually louder than the photography without good reason?
3. Does any section look like a generic UI component?
4. Is the homepage trying to show too much?
5. Does Selected Work feel elegant rather than gimmicky?
6. Does the hero transition feel calm?
7. Does metadata appear only when requested?
8. Is the mobile interaction understandable?
9. Does whitespace create rhythm?
10. Does the site feel coherent enough to become the design baseline for all future pages?

If any answer is unsatisfactory, revise the implementation.

---

# 24. Scope Control

For this task:

Build the homepage and the reusable interaction foundations required by the homepage.

Do not fully design:

* `/work`
* `/projects`
* `/films`
* `/places`
* `/about`

Navigation links may route to placeholders or existing pages as appropriate.

Do not spend time designing these destination pages yet.

The next phase will design each destination individually after the homepage visual language has been approved.

---

# 25. Definition of Done

The homepage is complete only when:

* navigation is implemented
* hero slideshow works smoothly
* hero contains photography only
* Selected Work continuously scrolls
* looping has no obvious seam
* hover pauses the strip
* drag/swipe works
* metadata reveal is staggered
* desktop click opens fullscreen
* mobile tap toggles metadata
* mobile long press opens fullscreen
* mobile interaction hint exists
* Selected Projects is implemented
* Places preview is implemented
* footer is implemented
* desktop and mobile have both been visually reviewed
* reduced-motion behavior exists
* no obvious generic AI-template visual patterns remain
* the page is suitable to serve as the design baseline for the rest of the website

Do not optimize for speed of completion.

Optimize for visual coherence, interaction quality and maintainable implementation.
