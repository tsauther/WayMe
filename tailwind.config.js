/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx,vue,svelte}'],
  theme: {
    extend: {
      borderRadius: {
        'xl': '16px',                 // global rounding for cards
        '2xl': '20px'
      },
      boxShadow: {
        m3:  '0 1px 2px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.04)',
        m3lg:'0 2px 4px rgba(0,0,0,.08), 0 8px 20px rgba(0,0,0,.06)'
      },
      fontSize: {
        'display': ['2rem', { lineHeight: '2.6rem', letterSpacing: '-0.01em', fontWeight: '800' }], // H1
        'headline': ['1.25rem', { lineHeight: '1.8rem', fontWeight: '700' }],  // H2/H3
        'title': ['1.125rem', { lineHeight: '1.6rem', fontWeight: '700' }],    // card titles
        'label': ['0.875rem', { lineHeight: '1.2rem', fontWeight: '600' }],    // chips/buttons
        'body': ['1rem', { lineHeight: '1.6rem' }]
      }
    }
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        waymeM3: {
          "primary":   "#3E73A3",   // tonal blue
          "primary-content": "#F4F7FB",
          "secondary": "#C27C5B",   // warm neutral for accents
          "accent":    "#6BA9B6",   // cyan/teal tone
          "neutral":   "#0E1B2B",   // deep ink for headings
          "base-100":  "#FAF7F2",   // warm off-white background
          "base-200":  "#F2EEE8",
          "base-300":  "#EAE4DC",
          "info":      "#5AA7E6",
          "success":   "#3BAE7E",
          "warning":   "#E7A23A",
          "error":     "#D66868",
          "--rounded-box": "16px",
          "--rounded-btn": "14px",
          "--rounded-badge": "9999px",
          "--btn-text-case": "none",
          "--btn-focus-scale": "0.97",
          "--animation-btn": "0",
          "--animation-input": "0",
          "--tab-radius": "12px"
        }
      },
      {
        waymeM3dark: {
          "primary":   "#8CB4D9",
          "primary-content": "#0F1720",
          "secondary": "#E0B199",
          "accent":    "#9CD3DD",
          "neutral":   "#E8EDF3",
          "base-100":  "#121417",
          "base-200":  "#181B20",
          "base-300":  "#21262D",
          "info":      "#7FC1F2",
          "success":   "#63C7A4",
          "warning":   "#F0BF6E",
          "error":     "#F08E8E",
          "--rounded-box": "16px",
          "--rounded-btn": "14px",
          "--rounded-badge": "9999px",
          "--btn-text-case": "none",
          "--btn-focus-scale": "0.97",
          "--animation-btn": "0",
          "--animation-input": "0",
          "--tab-radius": "12px"
        }
      }
    ]
  }
}
