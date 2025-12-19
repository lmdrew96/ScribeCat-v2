/**
 * Centralized Icon Map for ScribeCat v2
 *
 * This file provides a single source of truth for all Lucide icons used throughout the app.
 * Icons are organized by category for easy reference and maintenance.
 *
 * Usage:
 *   import { ICONS, getIconElement } from './utils/iconMap';
 *   const icon = getIconElement('file', { size: 16, color: 'currentColor' });
 */

import {
  // Documents & Files
  FileText,
  File,
  FileType,
  FileType2,
  FileEdit,
  BookOpen,
  Library,
  BookMarked,
  Folder,
  FolderOpen,
  AlignLeft,
  AlignRight,
  AlignCenter,
  Image,
  Table2,
  NotebookText,
  NotebookPen,
  Captions,
  CircleDotDashed,
  CalendarDays,
  BookUser,
  ChartBar,
  LayoutGrid,
  List,
  Kanban,

  // Study & Learning
  Lightbulb,
  Target,
  GraduationCap,
  Layers,
  HelpCircle,
  Map,
  Bookmark,
  Brain,

  // Recording & Audio
  Mic,
  Mic2,
  Volume2,
  VolumeX,
  Music,
  Headphones,
  Play,
  Pause,

  // UI Actions & Controls
  Check,
  X,
  XCircle,
  AlertCircle,
  Pencil,
  Edit,
  Trash2,
  Plus,
  Minus,
  Link,
  RefreshCw,
  Palette,
  Settings,
  Search,
  Bell,
  BellOff,
  Wrench,

  // Navigation & Arrows
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Undo2,
  Redo2,
  MoveLeft,
  MoveRight,
  Anchor,

  // Cloud & Sync
  Cloud,
  CloudUpload,
  CloudOff,
  CloudCog,
  Save,
  HardDrive,

  // Collaboration
  User,
  Users,
  Eye,
  Circle,
  MessageSquare,

  // Time & Calendar
  Calendar,
  Timer,
  Clock,
  Clock3,

  // Achievements & Celebrations
  Trophy,
  Star,
  Sparkles,
  Award,
  Gem,
  Flame,
  Medal,
  Lock,
  Crown,

  // Progress & Status
  Zap,
  Rocket,
  AlertTriangle,
  Info,

  // Games
  Gamepad2,
  Dices,
  BarChart3,

  // Special & Misc
  Globe,
  Moon,
  Sun,
  Sunrise,
  Mountain,
  Coffee,
  Bot,
  Smile,
  ClipboardList,
  Shield,
  CreditCard,
  Home,
  Laptop
} from 'lucide';

/**
 * Icon configuration type
 */
export interface IconConfig {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  [key: string]: any;
}

/**
 * Comprehensive icon map organized by usage category
 */
export const ICONS = {
  // Documents & Files
  file: FileText,
  fileAlt: File,
  filePdf: FileType,
  fileWord: FileType2,
  fileEdit: FileEdit,
  notes: FileEdit,
  book: BookOpen,
  library: Library,
  bookMarked: BookMarked,
  folder: Folder,
  folderOpen: FolderOpen,
  paragraph: AlignLeft,
  alignLeft: AlignLeft,
  alignRight: AlignRight,
  alignCenter: AlignCenter,
  image: Image,
  picture: Image,
  table: Table2,
  notebookText: NotebookText,
  studyMode: NotebookText,
  notebookPen: NotebookPen,
  hasNotes: NotebookPen,
  captions: Captions,
  hasTranscript: Captions,
  draft: CircleDotDashed,
  isDraft: CircleDotDashed,
  calendarDays: CalendarDays,
  timeline: CalendarDays,
  bookUser: BookUser,
  studyRooms: BookUser,
  chartBar: ChartBar,
  analytics: ChartBar,
  layoutGrid: LayoutGrid,
  gridView: LayoutGrid,
  list: List,
  listView: List,
  kanban: Kanban,
  boardView: Kanban,

  // Study & Learning Tools
  lightbulb: Lightbulb,
  concept: Lightbulb,
  target: Target,
  weakSpots: Target,
  graduation: GraduationCap,
  flashcards: Layers,
  layers: Layers,
  helpCircle: HelpCircle,
  eli5: HelpCircle,
  map: Map,
  conceptMap: Map,
  bookmark: Bookmark,
  brain: Brain,

  // Recording & Audio
  mic: Mic,
  mic2: Mic2,
  recording: Mic,
  volume: Volume2,
  volumeMuted: VolumeX,
  audio: Music,
  headphones: Headphones,
  play: Play,
  pause: Pause,

  // UI Actions
  check: Check,
  success: Check,
  close: X,
  error: XCircle,
  alert: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  edit: Edit,
  pencil: Pencil,
  delete: Trash2,
  trash: Trash2,
  add: Plus,
  plus: Plus,
  minus: Minus,
  horizontalRule: Minus,
  link: Link,
  share: Link,
  refresh: RefreshCw,
  retranscribe: RefreshCw,
  sync: RefreshCw,
  theme: Palette,
  palette: Palette,
  settings: Settings,
  search: Search,
  bell: Bell,
  bellOff: BellOff,
  notification: Bell,
  wrench: Wrench,
  tool: Wrench,

  // Navigation & Arrows
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowLeftRight: ArrowLeftRight,
  moveLeft: MoveLeft,
  moveRight: MoveRight,
  anchor: Anchor,
  undo: Undo2,
  redo: Redo2,
  restore: Undo2,

  // Cloud & Storage
  cloud: Cloud,
  cloudUpload: CloudUpload,
  cloudSyncing: CloudUpload,
  cloudOff: CloudOff,
  cloudFailed: CloudOff,
  cloudSettings: CloudCog,
  save: Save,
  storage: HardDrive,

  // Collaboration & Sharing
  user: User,
  userProfile: User,
  users: Users,
  collaborators: Users,
  eye: Eye,
  viewer: Eye,
  status: Circle,
  active: Circle,
  chat: MessageSquare,
  message: MessageSquare,

  // Time & Calendar
  calendar: Calendar,
  studyPlan: Calendar,
  timer: Timer,
  clock: Clock,
  clockHour: Clock3,

  // Achievements & Gamification
  trophy: Trophy,
  star: Star,
  highlight: Star,
  sparkles: Sparkles,
  sparkle: Sparkles,
  legendary: Sparkles,
  award: Award,
  perfect: Award,
  gem: Gem,
  diamond: Gem,
  flame: Flame,
  streak: Flame,
  medal: Medal,
  lock: Lock,
  locked: Lock,
  crown: Crown,

  // Games
  gamepad: Gamepad2,
  game: Gamepad2,
  dice: Dices,
  chart: BarChart3,
  barChart: BarChart3,

  // Progress & Energy
  zap: Zap,
  energy: Zap,
  lightning: Zap,
  rocket: Rocket,
  launch: Rocket,

  // Special & Miscellaneous
  web: Globe,
  html: Globe,
  moon: Moon,
  sun: Sun,
  sunrise: Sunrise,
  earlyBird: Sunrise,
  mountain: Mountain,
  weekend: Mountain,
  coffee: Coffee,
  breakTime: Coffee,
  bot: Bot,
  ai: Bot,
  smile: Smile,
  emoji: Smile,
  clipboard: ClipboardList,
  shield: Shield,
  superhero: Shield,
  card: CreditCard,
  quiz: CreditCard,
  home: Home,
  house: Home,
  laptop: Laptop,
  code: Laptop,
  help: HelpCircle,
} as const;

/**
 * Type for all available icon keys
 */
export type IconKey = keyof typeof ICONS;

/**
 * Cache for converted icon paths - using plain object to avoid Map bundling issues
 */
const IconPathCache: Record<string, string> = {};

/**
 * Convert Lucide icon data to SVG path string
 */
function getIconPathString(iconData: any): string {
  if (!Array.isArray(iconData)) {
    return '';
  }

  let svgContent = '';
  for (const element of iconData) {
    if (Array.isArray(element) && element.length >= 2) {
      const [tag, attrs] = element;
      const attrString = Object.entries(attrs || {})
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      svgContent += `<${tag} ${attrString}/>`;
    }
  }
  return svgContent;
}

/**
 * Get an icon as an HTML string
 *
 * @param key - The icon key from ICONS map
 * @param config - Optional icon configuration
 * @returns SVG markup as string
 *
 * @example
 * const iconHtml = getIconHTML('star', { size: 20 });
 * element.innerHTML = iconHtml;
 */
export function getIconHTML(key: IconKey, config: IconConfig = {}): string {
  const iconData = ICONS[key] as any;
  if (!iconData) {
    console.warn(`[IconMap] Icon "${key}" not found in ICONS map`);
    return '';
  }

  const {
    size = 16,
    color = 'currentColor',
    strokeWidth = 2,
    className = '',
    ...rest
  } = config;

  // Get or create cached path string
  let pathString = IconPathCache[key];
  if (!pathString) {
    pathString = getIconPathString(iconData);
    IconPathCache[key] = pathString;
  }

  // Build extra attributes
  let extraAttrs = '';
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined && v !== null) {
      extraAttrs += ` ${k}="${v}"`;
    }
  }

  // Return complete SVG string
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${className ? ` class="${className}"` : ''}${extraAttrs}>${pathString}</svg>`;
}

/**
 * Get an icon element with specified configuration
 *
 * @param key - The icon key from ICONS map
 * @param config - Optional icon configuration (size, color, etc.)
 * @returns SVG icon element or null if key not found
 *
 * @example
 * const icon = getIconElement('file', { size: 16, color: '#333' });
 */
export function getIconElement(key: IconKey, config: IconConfig = {}): SVGElement | null {
  const svgString = getIconHTML(key, config);
  if (!svgString) {
    return null;
  }

  // Parse the SVG string into a DOM element
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  return doc.documentElement as unknown as SVGElement;
}

/**
 * Default icon configurations for common use cases
 */
export const ICON_PRESETS = {
  button: { size: 16, strokeWidth: 2 },
  toolbar: { size: 18, strokeWidth: 2 },
  header: { size: 20, strokeWidth: 2 },
  large: { size: 24, strokeWidth: 2 },
  hero: { size: 48, strokeWidth: 1.5 },
} as const;

/**
 * Get an icon element with a preset configuration
 *
 * @param key - The icon key
 * @param preset - Preset name from ICON_PRESETS
 * @param overrides - Additional config to override preset
 * @returns SVG icon element
 *
 * @example
 * const icon = getIconWithPreset('star', 'button', { color: '#FFD700' });
 */
export function getIconWithPreset(
  key: IconKey,
  preset: keyof typeof ICON_PRESETS,
  overrides: IconConfig = {}
): SVGElement | null {
  const presetConfig = ICON_PRESETS[preset];
  return getIconElement(key, { ...presetConfig, ...overrides });
}
