# throughmylens — Design System

## 0. Document Role and Priority

This document defines the long-term visual and interaction principles of ThroughMyLens.

It should guide design decisions, but it is not a frozen implementation specification.

Priority when instructions conflict:

1. The user's current explicit request
2. Existing user-approved implementation and behavior
3. `AGENTS.md` repository working rules
4. The principles in this `DESIGN.md`
5. Examples, recommended timings, dimensions, and implementation suggestions in this document

Do not revert an intentional existing design solely because it differs from an older example or recommended value in this document.

Exact timings, image counts, dimensions, routes, and layout examples should be treated as design defaults unless explicitly marked as requirements.

When an intentional design change is approved and materially changes a long-term principle, update this document accordingly.

## 1. Project Positioning

This website is a personal photography portfolio and visual archive.

It is not:

- a SaaS landing page
- a commercial agency homepage
- a photography community
- a social media clone
- a generic portfolio template
- a blog-first website
- a UI showcase

The website exists primarily to present photography, visual projects and films in a calm, deliberate and immersive way.

The photographer's work must always remain visually dominant.

The interface should support the photographs rather than compete with them.

The overall experience should feel closer to:

- a carefully art-directed photography book
- a contemporary photography exhibition
- an editorial portfolio
- a visual archive

rather than a conventional web application.

---

# 2. Core Design Philosophy

The core principle is:

> The photographs provide the color.  
> The website provides the space.

Visual sophistication should come from:

- image selection
- image scale
- composition
- whitespace
- typography
- pacing
- rhythm
- proportion
- restrained interaction
- subtle motion

Do not create sophistication through decorative UI effects.

The interface should feel quiet, restrained and intentional.

The visitor should notice the photographs before noticing the website itself.

---

# 3. Brand Character

Desired visual qualities:

- quiet
- restrained
- editorial
- cinematic
- observational
- contemporary
- timeless
- human
- refined
- minimal

Avoid making the website feel:

- futuristic
- cyberpunk
- overly luxurious
- flashy
- corporate
- commercial
- startup-like
- heavily animated
- decorative
- trendy for the sake of being trendy

Minimalism does not mean emptiness.

Every spacing decision, image size, transition and text placement should feel intentional.

---

# 4. Primary Navigation

Primary public navigation:

- Work
- Projects
- Films
- Places
- About

The brand identity / site title should remain visually separate from the navigation.

Example:

SHEPS.LOG                    Work   Projects   Films   Places   About

Navigation should remain visually lightweight.

Do not use:

- pill-shaped navigation
- large buttons
- icons next to every menu item
- colored navigation backgrounds unless necessary for readability
- thick borders
- excessive separators

Hover states should be subtle.

Recommended hover treatments:

- opacity change
- thin underline
- slight text tone change

Do not use exaggerated animations.

---

# 5. Homepage Purpose

The homepage is not intended to contain all content.

Its purpose is to introduce the visual identity and guide visitors toward deeper sections of the website.

The homepage should create curiosity rather than provide exhaustive browsing.

Primary homepage structure:

1. Header
2. Hero slideshow
3. Selected Work
4. Selected Projects
5. Places
6. Footer

Films does not currently require a dedicated homepage section.

Films remains accessible through the primary navigation.

A Featured Film section may be introduced later if an individual film deserves homepage prominence.

---

# 6. Hero Design

## Purpose

The hero is a visual introduction.

It must contain photography only.

Do not place any of the following over the hero:

- slogan
- introductory paragraph
- CTA button
- title
- project description
- decorative text
- slide indicators unless absolutely necessary
- promotional messaging

The navigation may overlay the hero if readability remains excellent.

---

## Hero Slideshow

The photographer should be able to manually select and order several hero images.

Recommended number:

3–6 images.

The slideshow should use a calm crossfade transition.

Recommended timing:

- image display duration: approximately 6–8 seconds
- crossfade duration: approximately 1.2–1.8 seconds

Do not use:

- horizontal carousel movement
- card slides
- abrupt transitions
- rotating cube effects
- dramatic parallax
- obvious zoom animations
- swipe indicators
- large arrows

A very subtle image scale transition may be explored later, but the default implementation should use crossfade only.

The slideshow should loop seamlessly.

---

## Responsive Image Cropping

Photography composition must be respected.

The CMS or image data structure should eventually support a focal point or object-position value for hero images.

Different viewport ratios must not blindly crop important photographic subjects.

Desktop and mobile cropping should be visually reviewed.

---

# 7. Selected Work

## Purpose

Selected Work is a preview of the photographer's broader portfolio.

It should not become a complete gallery on the homepage.

The full browsing experience belongs on `/work`.

---

## Layout

Selected Work should use a continuous horizontal image strip.

The strip should:

- contain both landscape and portrait photographs
- preserve each photograph's natural aspect ratio
- have zero gap between images
- appear visually continuous
- move automatically from right to left
- loop infinitely without a visible jump

The image strip should feel closer to a moving contact sheet or editorial photographic sequence than a conventional carousel.

Avoid:

- cards
- individual borders
- rounded corners
- shadows
- captions permanently displayed below every photo
- carousel dots
- large navigation arrows

---

## Motion

Automatic motion should be very slow.

The visitor should not immediately perceive it as a "marquee".

The motion should feel ambient.

A full viewport-width movement should take approximately 20–35 seconds, depending on final visual testing.

The exact speed should be visually tuned.

---

## Interaction

Desktop:

- hovering the Selected Work strip pauses automatic movement
- users may click-drag horizontally
- releasing the drag allows automatic movement to resume naturally

Mobile:

- users may swipe horizontally
- automatic motion should resume after manual interaction
- native-feeling inertial movement is preferred

Do not show a scrollbar.

---

## Selected Work Header

Use a restrained text row such as:

Selected Work                                      Explore Work →

The heading and link should not visually compete with the photography.

The full module should remain relatively compact compared with the hero.

---

# 8. Image Metadata Interaction

Image information should remain hidden by default.

The photograph should be presented without persistent technical information.

Metadata appears only when the visitor intentionally interacts with the photograph.

---

## Desktop Interaction

On hover:

Stage 1:

Reveal location and date.

Example:

Harbin, China · January 2026

Stage 2:

After a short delay, reveal photographic parameters.

Example:

50mm · f/4 · 1/320s · ISO 100

Suggested timing:

- location/date begin appearing after approximately 150–250 ms
- camera parameters appear approximately 150–250 ms later

On mouse leave:

- camera parameters fade first
- location/date fade shortly afterward

The disappearance should feel slightly staggered rather than abrupt.

---

## Metadata Presentation

Metadata should preferably appear near the lower-left area of the photograph.

It must remain readable without significantly altering the image.

Use only a subtle local gradient if necessary.

Do not cover the entire photograph with a dark overlay.

Suggested hierarchy:

Location / Date:
- visually stronger
- small typography
- high readability

Camera parameters:
- lower opacity
- secondary importance
- slightly smaller or lighter

Technical metadata is secondary information.

The photograph remains primary.

---

# 9. Fullscreen Image Interaction

## Desktop

Clicking an image opens fullscreen viewing.

The transition should feel like the photograph expands from its original position.

Preferred animation concept:

1. photograph is clicked
2. background begins fading darker
3. image smoothly expands and moves toward viewport center
4. fullscreen viewing state is reached

Closing should reverse the interaction.

Recommended duration:

approximately 300–450 ms.

The animation should feel lightweight and smooth.

Avoid:

- sudden black-screen lightbox
- heavy modal effects
- bouncing
- excessive scaling
- dramatic blur

A shared-element style transition is preferred.

---

## Mobile

Interaction model:

- first tap: reveal metadata
- second tap: hide metadata
- long press: enter fullscreen viewer

Long press threshold:

approximately 400–500 ms.

A subtle press acknowledgement may be used while the threshold is being reached.

Examples:

- extremely subtle scale reduction
- slight opacity response

Do not make the photograph behave visually like a button.

---

## Mobile Interaction Guide

On the user's first visit, a minimal interaction hint may appear:

Tap for details · Hold to view

The hint should:

- appear only briefly
- fade automatically
- remain visually subtle
- not repeatedly interrupt returning users

It should not become a persistent tutorial overlay.

---

# 10. Selected Projects

Selected Projects should visually differ clearly from Selected Work.

Selected Work is a stream of individual photographs.

Projects represent coherent photographic series.

The homepage should display approximately 2–3 selected projects.

Each project may contain:

- large cover image
- project title
- year
- optionally a very short descriptor

Do not place large explanatory paragraphs on the homepage.

Project presentation should resemble photography book covers or exhibition entries.

Projects require generous whitespace.

Example:

[ large project cover ]

Qilian Mountains  
2026

The full project experience belongs on:

`/projects/[project]`

---

# 11. Places

Places is both:

- a primary navigation item
- a homepage discovery section

The homepage Places section should introduce geographic browsing without becoming a complex mapping application.

The map should feel visually integrated with the photography website.

Preferred style:

- minimal map
- restrained outlines
- limited labels
- subtle location markers
- no unnecessary map UI controls

Avoid visually dominant commercial map styling where possible.

The map should not resemble a logistics or navigation application.

Possible interaction:

- hover a location
- show a small photograph preview
- click location
- open corresponding place or map view

Homepage should include an understated:

Explore Places →

The complete map experience belongs on `/places`.

---

# 12. Typography

Typography should feel editorial and understated.

Use a limited number of:

- typefaces
- font weights
- font sizes

Prefer a clean hierarchy rather than many visual styles.

Navigation should remain relatively small.

Section titles should be restrained.

Avoid:

- giant startup-style display headings
- excessive bold
- decorative typography
- too many font weights
- large uppercase text everywhere

Typography should frame photography, not dominate it.

---

# 13. Color System

The primary interface palette should remain neutral.

Recommended base palette:

- white or warm white
- near black
- subtle neutral gray

The photography itself provides the dominant color.

Strong brand colors should not be introduced without a specific reason.

Avoid:

- blue/purple gradients
- neon colors
- decorative accent colors
- strong colored section backgrounds
- excessive dark/light alternation

A mostly neutral environment is preferred.

---

# 14. Image Styling

Photographs should normally have:

- no border radius
- no shadow
- no border
- no decorative frame

Do not automatically crop every photograph into a uniform ratio.

Landscape, portrait, square and panoramic photography should coexist naturally.

Image scale and whitespace should respond to photographic composition.

---

# 15. Motion Principles

Motion should be:

- slow
- subtle
- smooth
- meaningful
- spatially understandable

Motion should support continuity.

Recommended uses:

- crossfade
- opacity transitions
- shared-element image expansion
- subtle navigation transitions
- slow continuous image movement

Avoid:

- bouncing
- elastic motion
- spinning
- large-scale parallax
- scroll hijacking
- exaggerated zoom
- flashy page transitions
- decorative motion without functional value

Do not add animation merely because a library makes it easy.

---

# 16. Spacing and Rhythm

The website should alternate between visually dense photography sections and generous whitespace.

Example rhythm:

Hero
→ Selected Work
→ large breathing space
→ Selected Projects
→ breathing space
→ Places
→ Footer

Do not make every section the same height.

Do not force symmetrical repetition across the entire homepage.

Editorial rhythm is preferred over rigid dashboard consistency.

---

# 17. Responsive Design

The website must be intentionally designed for:

- desktop
- tablet
- mobile

Do not simply stack desktop components vertically.

Mobile interaction should be treated as its own interaction environment.

Important differences include:

Desktop:
- hover metadata
- click fullscreen
- click-drag galleries

Mobile:
- tap metadata
- long press fullscreen
- swipe galleries

Hero cropping and image composition require manual visual inspection on mobile.

---

# 18. Performance

Photography quality is important, but the website must remain responsive.

Use appropriate image optimization.

Prefer:

- responsive images
- modern formats where suitable
- image preloading only where justified
- lazy loading below the fold
- thumbnail/full-resolution separation where appropriate

Hero transitions must not produce visible loading gaps.

The next hero image should be prepared before transition.

Do not preload the entire photography archive.

Performance decisions must preserve visual quality without making navigation feel heavy.

---

# 19. Accessibility

Minimalism must not reduce usability.

Ensure:

- navigation remains keyboard accessible
- fullscreen viewer can be closed via Escape
- focus states exist
- interactive elements remain discoverable
- sufficient text contrast
- reduced-motion preferences are respected

When `prefers-reduced-motion` is enabled:

- remove unnecessary movement
- replace continuous motion with a static or manually scrollable layout where appropriate
- simplify transitions

---

# 20. Anti-Patterns

Do not default to common AI-generated website aesthetics.

Specifically avoid:

- giant gradient hero text
- blue/purple gradients
- glassmorphism
- oversized rounded cards
- glowing buttons
- excessive border radius
- floating cards
- unnecessary icons
- badge-heavy interfaces
- dashboard-like layouts
- heavy use of shadows
- decorative blobs
- random abstract shapes
- generic "creative portfolio" templates
- startup CTA sections
- testimonial sections
- meaningless metrics
- excessive Framer Motion
- excessive hover scaling
- every section inside a rounded container

Do not make the website resemble:

- a Tailwind component showcase
- a Bootstrap template
- a SaaS homepage
- a Web3 landing page
- a generic agency portfolio
- a Pinterest clone
- an Unsplash clone

---

# 21. Design Review Requirement

Any UI implementation must be visually reviewed after rendering.

Do not consider a page complete immediately after writing the code.

After implementation:

1. run the website
2. inspect the page at desktop size
3. inspect the page at mobile size
4. compare against this DESIGN.md
5. identify visual inconsistencies
6. revise them
7. inspect again

Evaluate:

- photographic dominance
- spacing
- typography
- rhythm
- density
- alignment
- responsiveness
- transition quality
- interaction discoverability
- whether the result looks generic or template-generated

If it still looks generic, revise it before completion.

---

# 22. Final Design Principle

The interface should gradually disappear from the visitor's attention.

The visitor should remember:

- the photographs
- the atmosphere
- the places
- the projects

rather than the UI.

The website should feel designed, but should never feel over-designed.