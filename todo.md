> 未提前声明时切勿参考此文件中的信息。

## 1. 首页精选作品下方的文字提示“轻触查看信息 · 长按放大”要与右侧的“暂停动态”保持在同一高度显示

## 2. work页面底部设计
Add a restrained end-of-gallery treatment to the Work page.

1. Increase the breathing room after the final gallery row before the footer.
2. Add a subtle horizontal divider aligned with the gallery content width to visually mark the end of the photographic sequence.
3. Implement bottom boundary feedback:
   - When the viewport is already at the bottom and the user continues scrolling downward, do not leave the interface completely static.
   - Apply a small resisted displacement to the end/footer section.
   - Maximum desktop displacement should remain subtle, roughly 6–12px.
   - Larger input must produce diminishing additional movement rather than linear displacement.
   - When scrolling input stops, return smoothly with a damped spring.
   - The divider may participate with an extremely subtle compression/stretch response.
   - Do not create exaggerated bouncing or playful elastic motion.
4. Preserve native scrolling. Do not replace the page with a custom scroll container.
5. Be especially careful with touch devices and native browser overscroll behavior; avoid fighting native scrolling.
6. Respect `prefers-reduced-motion`.
7. Keep the interaction consistent with the quiet, restrained, editorial visual language defined in DESIGN.md.

The intended feeling is physical resistance at the end of a photographic book/page, not a decorative animation.