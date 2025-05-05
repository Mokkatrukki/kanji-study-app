/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/views/**/*.ejs", // Scan EJS views
        "./src/public/ts/**/*.ts" // Scan client-side TS for classes
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}