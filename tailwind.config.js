/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Neoclima brand colors ─────────────────────────
        nc: {
          red:         '#C0392B',
          'red-dark':  '#922B21',
          'red-light': '#E74C3C',
          blue:        '#2C3E50',
          'blue-dark': '#1A252F',
          'blue-light':'#34495E',
        },

        // ── Statuts tâches ────────────────────────────────
        status: {
          todo:         '#94A3B8',
          en_cours:     '#3B82F6',
          done:         '#22C55E',
          blocked:      '#EF4444',
          nappe_h:      '#8B5CF6',
          nappe_b:      '#6366F1',
          terminaux:    '#F59E0B',
          raccordement: '#10B981',
        },

        // ── Contraintes ───────────────────────────────────
        contrainte: {
          ouverte:  '#EF4444',
          en_cours: '#F59E0B',
          levee:    '#22C55E',
        },

        // ── Gravité NC (renommé pour éviter collision) ────
        gravite: {
          mineure:   '#F59E0B',
          majeure:   '#EF4444',
          bloquante: '#7F1D1D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
}
