/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html", // Scan HTML file
        "./src/**/*.{js,ts}", // Scan TS/JS files in src
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}