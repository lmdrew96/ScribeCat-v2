/**
 * Tutorial type definitions
 */

export interface TutorialStep {
  /** Selector for element to highlight */
  target: string;
  /** Title of the step */
  title: string;
  /** Description/instruction text */
  content: string;
  /** Position of tooltip relative to target */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Action to perform before showing step (e.g., open a panel) */
  beforeShow?: () => void | Promise<void>;
  /** Action to perform after step is completed */
  afterComplete?: () => void;
  /** Custom action button */
  action?: {
    text: string;
    onClick: () => void | Promise<void>;
  };
  /** If true, automatically skip this step if the target element is not found */
  optional?: boolean;
}

export interface Tutorial {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  /** Whether this tutorial can be auto-started */
  autoStart?: boolean;
  /** Minimum wait time before auto-start (ms) */
  autoStartDelay?: number;
}
