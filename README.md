# GlowUp Frontend
## Key aspects
### 1. Language: English
### 2. Customizable Accent Color
See `css/variables.css` for easy color customization.
To change the accent color, modify these values in the CSS:
```css
:root {
    --color-primary: #d4a373;           /* Main accent */
    --color-primary-light: #e8c9a8;     /* Light variant */
    --color-primary-dark: #b8956a;      /* Dark variant */
    --color-primary-rgb: 212, 163, 115; /* For rgba() */
}
```
### Preset Themes Available:
| Theme | Color Code |
|-------|------------|
| Beige/Tan (current) | `#d4a373` |
| Rose Gold | `#B76E79` |
| Sage Green | `#9CAF88` |
| Dusty Blue | `#6B8E9B` |
| Lavender | `#9B8AA5` |
| Coral | `#E07A5F` |

## File Structure

```
frontend/
├── index.html          # Login/Register page
├── dashboard.html      # Main dashboard
├── css/
│   ├── styles.css      # Main styles (replace :root with variables.css content)
│   └── variables.css   # Color variables (merge into styles.css)
└── js/
    ├── app.js          # Auth logic
    └── dashboard.js    # Dashboard logic
```
---

## How to Change the Accent Color

1. Open `css/styles.css`
2. Find the `:root` section at the top
3. Change `--color-primary` to your desired color
4. Update `--color-primary-light` (add ~20% white)
5. Update `--color-primary-dark` (add ~20% black)
6. Update `--color-primary-rgb` (RGB values for transparency)
7. Optionally update `--bg-main` for a matching background
8. Update `--shadow-glow` with the new primary color

Example for Rose Gold:
```css
:root {
    --color-primary: #B76E79;
    --color-primary-light: #D4A5AD;
    --color-primary-dark: #8B4D55;
    --color-primary-rgb: 183, 110, 121;
    --bg-main: #FDF5F6;
    --shadow-glow: 0 0 30px rgba(183, 110, 121, 0.3);
}
```