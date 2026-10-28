import { useReducedMotion } from 'react-native-reanimated';

const swipeable_motion = {
  friction: 1,
  overshootFriction: 8,
  overshootRight: true,
  // Swipeable supplies bounciness, so stay in the compatible speed parameter family.
  animationOptions: {
    bounciness: 0,
    speed: 8,
    restSpeedThreshold: 0.5,
    restDisplacementThreshold: 0.1,
  },
};

const reduced_swipeable_motion = {
  ...swipeable_motion,
  overshootRight: false,
  animationOptions: {
    bounciness: 0,
    speed: 100,
    restSpeedThreshold: 1.7,
    restDisplacementThreshold: 0.4,
  },
};

export function useSwipeableMotion() {
  const reduce_motion = useReducedMotion();

  return reduce_motion ? reduced_swipeable_motion : swipeable_motion;
}
