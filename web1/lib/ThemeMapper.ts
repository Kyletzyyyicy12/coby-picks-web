// Theme Mapper Utility for Cross-Platform Theme Synchronization
// Converts between web CSS themes and mobile React Native themes

// Web theme options mapping (from quick-activity-creator.tsx)
export const webThemeMapping = {
  school: {
    primary: '#8E0B16', // SWU Red
    secondary: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    text: '#212121',
    accent: '#FFC107'
  },
  vibrant: {
    primary: '#FF6B35',
    secondary: '#F7931E',
    background: '#FFF8F0',
    surface: '#FFFFFF',
    text: '#2C2C2C',
    accent: '#FFD23F'
  },
  minimal: {
    primary: '#6B7280',
    secondary: '#9CA3AF',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: '#111827',
    accent: '#D1D5DB'
  },
  ocean: {
    primary: '#0EA5E9',
    secondary: '#0284C7',
    background: '#F0F9FF',
    surface: '#FFFFFF',
    text: '#0C4A6E',
    accent: '#38BDF8'
  },
  forest: {
    primary: '#059669',
    secondary: '#10B981',
    background: '#F0FDF4',
    surface: '#FFFFFF',
    text: '#064E3B',
    accent: '#34D399'
  },
  sunset: {
    primary: '#EA580C',
    secondary: '#FB923C',
    background: '#FFF7ED',
    surface: '#FFFFFF',
    text: '#9A3412',
    accent: '#FDBA74'
  },
  purple: {
    primary: '#9333EA',
    secondary: '#A855F7',
    background: '#FAF5FF',
    surface: '#FFFFFF',
    text: '#581C87',
    accent: '#C084FC'
  },
  pink: {
    primary: '#EC4899',
    secondary: '#F472B6',
    background: '#FDF2F8',
    surface: '#FFFFFF',
    text: '#831843',
    accent: '#F9A8D4'
  },
  dark: {
    primary: '#8E0B16',
    secondary: '#DC2626',
    background: '#111827',
    surface: '#1F2937',
    text: '#F9FAFB',
    accent: '#FEF3C7'
  },
  neon: {
    primary: '#10B981',
    secondary: '#06B6D4',
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F1F5F9',
    accent: '#FBBF24'
  },
  retro: {
    primary: '#DB2777',
    secondary: '#F59E0B',
    background: '#FEF7FF',
    surface: '#FFFFFF',
    text: '#92400E',
    accent: '#A78BFA'
  },
  gold: {
    primary: '#D97706',
    secondary: '#F59E0B',
    background: '#FFFBEB',
    surface: '#FFFFFF',
    text: '#92400E',
    accent: '#FCD34D'
  }
};

// Convert web theme to mobile Theme object
export function webThemeToMobile(webThemeName: string, isDark: boolean = false) {
  const baseTheme = webThemeMapping[webThemeName as keyof typeof webThemeMapping] || webThemeMapping.school;
  
  return {
    primary: baseTheme.primary,
    secondary: baseTheme.secondary,
    background: isDark ? '#121212' : baseTheme.background,
    surface: isDark ? '#1E1E1E' : baseTheme.surface,
    text: isDark ? '#FFFFFF' : baseTheme.text,
    textSecondary: isDark ? '#AAAAAA' : '#757575',
    border: isDark ? '#616161' : '#BDBDBD',
    error: '#D32F2F',
    success: '#4CAF50',
    accent: baseTheme.accent,
    onPrimary: '#FFFFFF',
    onSecondary: isDark ? '#FFFFFF' : '#212121',
    onBackground: isDark ? '#FFFFFF' : '#212121',
    onSurface: isDark ? '#FFFFFF' : '#212121',
    onError: '#FFFFFF',
    isDark
  };
}

// Convert CSS HSL values to hex colors
export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Convert web CSS variables to mobile theme
export function cssVariablesToMobileTheme(cssVars: { [key: string]: string }): Partial<any> {
  const parseHSL = (hslString: string): [number, number, number] => {
    const match = hslString.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
    if (match) {
      return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
    }
    return [0, 0, 50]; // fallback
  };

  const theme: any = {};

  // Convert primary color
  if (cssVars['--primary']) {
    const [h, s, l] = parseHSL(cssVars['--primary']);
    theme.primary = hslToHex(h, s, l);
  }

  // Convert background color
  if (cssVars['--background']) {
    const [h, s, l] = parseHSL(cssVars['--background']);
    theme.background = hslToHex(h, s, l);
    theme.isDark = l < 20; // Determine if dark theme based on lightness
  }

  // Convert text color
  if (cssVars['--foreground']) {
    const [h, s, l] = parseHSL(cssVars['--foreground']);
    theme.text = hslToHex(h, s, l);
  }

  // Convert surface color
  if (cssVars['--card']) {
    const [h, s, l] = parseHSL(cssVars['--card']);
    theme.surface = hslToHex(h, s, l);
  }

  // Convert accent color
  if (cssVars['--accent']) {
    const [h, s, l] = parseHSL(cssVars['--accent']);
    theme.accent = hslToHex(h, s, l);
  }

  return theme;
}

// Get theme colors from session theme config
export function getThemeFromSessionConfig(themeConfig: any): any | null {
  if (!themeConfig) return null;

  // If custom colors are provided, use them
  if (themeConfig.customColors) {
    return {
      primary: themeConfig.customColors.primary || '#8E0B16',
      secondary: themeConfig.customColors.secondary || '#FFFFFF',
      background: themeConfig.customColors.background || '#FFFFFF',
      surface: themeConfig.customColors.surface || '#F8F9FA',
      text: themeConfig.customColors.text || '#212121',
      textSecondary: '#757575',
      border: '#BDBDBD',
      error: '#D32F2F',
      success: '#4CAF50',
      accent: themeConfig.customColors.accent || '#FFC107',
      onPrimary: '#FFFFFF',
      onSecondary: '#212121',
      onBackground: '#212121',
      onSurface: '#212121',
      onError: '#FFFFFF',
      isDark: false
    };
  }

  // Otherwise, convert from organizer theme name
  if (themeConfig.organizerTheme) {
    const isDark = themeConfig.organizerTheme.includes('dark');
    return webThemeToMobile(themeConfig.organizerTheme, isDark);
  }

  return null;
}

// Create theme config for session from web theme
export function createSessionThemeConfig(webThemeName: string, wheelTheme?: string): any {
  const mobileTheme = webThemeToMobile(webThemeName);
  
  return {
    organizerTheme: webThemeName,
    customColors: {
      primary: mobileTheme.primary,
      secondary: mobileTheme.secondary,
      background: mobileTheme.background,
      surface: mobileTheme.surface,
      text: mobileTheme.text,
      accent: mobileTheme.accent
    },
    wheelTheme: wheelTheme || 'school',
    syncEnabled: true,
    lastThemeUpdate: new Date()
  };
}