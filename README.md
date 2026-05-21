# Collaborative Visual Canvas Board

A lightweight, self-hosted, full-stack digital whiteboard application built from scratch. It features an infinite grid canvas workspace where users can spawn rectangular nodes, drag them dynamically at 60 FPS, and map permanent structural lines (edges) between them.

---

##  Key Architectural Features
* **Decoupled Architecture:** Clean Python Flask REST API backend paired with a modern vanilla HTML5 Canvas frontend.
* **Graph-Based Relational Storage:** Utilizes a local SQLite database with strict foreign key constraints tracking graph node relationships.
* **Performance Optimized:** Leverages a `requestAnimationFrame` render loop on the client side, along with a custom trailing-edge network debounce strategy to prevent database save bottlenecks during drag transformations.
* **Native CORS Configuration:** Custom middleware hooks built into the Flask router pipeline allow flexible cross-origin serving environments.

---

##  Project Structure
* `app.py` — Flask API routing and database persistence management layer.
* `index.html` — Fullscreen canvas view template featuring dark-mode engineering grids.
* `canvas.js` — Client-side layout logic, interactive collision detection, and network sync bridges.

---

##  How to Run the App Locally

### 1. Install Dependencies
Open your terminal or command prompt inside this project folder and install Flask:
```bash
pip install flask
