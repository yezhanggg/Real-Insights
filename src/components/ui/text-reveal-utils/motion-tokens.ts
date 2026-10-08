// Timing for text-reveal. Seconds and pixels; the easing and word duration live beside the keyframes in the CSS.
export const motionTokens = {
  duration: {
    /** The longest a whole line may take to finish staggering in. */
    considered: 0.9,
  },
  stagger: {
    /** The gap between one word starting and the next. */
    word: 0.07,
  },
  blur: {
    /** Body-size text. */
    soft: 5,
    /** Headings. */
    text: 8,
  },
} as const;
