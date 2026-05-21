import sqlite3
import uuid
from flask import Flask, jsonify, request

app = Flask(__name__)
DB_FILE = "canvas_board.db"


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL
            )
        """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS edges (
                id TEXT PRIMARY KEY,
                from_node TEXT NOT NULL,
                to_node TEXT NOT NULL,
                FOREIGN KEY (from_node) REFERENCES nodes (id) ON DELETE CASCADE,
                FOREIGN KEY (to_node) REFERENCES nodes (id) ON DELETE CASCADE
            )
        """
        )
        conn.commit()


# --- Simple Native CORS Middleware Hooks ---
@app.after_request
def apply_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = (
        "GET, POST, PATCH, OPTIONS"
    )
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.route("/api/board", methods=["GET", "OPTIONS"])
def handle_board():
    if request.method == "OPTIONS":
        return "", 204

    with get_db_connection() as conn:
        nodes_cursor = conn.execute("SELECT id, title, x, y FROM nodes").fetchall()
        edges_cursor = conn.execute(
            "SELECT id, from_node, to_node FROM edges"
        ).fetchall()

    return jsonify(
        {
            "nodes": [dict(row) for row in nodes_cursor],
            "edges": [dict(row) for row in edges_cursor],
        }
    )


@app.route("/api/nodes", methods=["POST", "OPTIONS"])
def create_node():
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json() or {}
    node_id = str(uuid.uuid4())
    title = data.get("title", f"Node {node_id[:4]}")
    x = data.get("x", 100.0)
    y = data.get("y", 100.0)

    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO nodes (id, title, x, y) VALUES (?, ?, ?, ?)",
            (node_id, title, x, y),
        )
        conn.commit()

    return jsonify({"id": node_id, "title": title, "x": x, "y": y}), 201


@app.route("/api/nodes/<node_id>", methods=["PATCH", "OPTIONS"])
def update_node_position(node_id):
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json() or {}
    if "x" not in data or "y" not in data:
        return jsonify({"error": "Missing coordinates"}), 400

    with get_db_connection() as conn:
        cursor = conn.execute(
            "UPDATE nodes SET x = ?, y = ? WHERE id = ?",
            (data["x"], data["y"], node_id),
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"error": "Node not found"}), 404

    return jsonify({"success": True}), 200


@app.route("/api/edges", methods=["POST", "OPTIONS"])
def create_edge():
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json() or {}
    from_node = data.get("from_node")
    to_node = data.get("to_node")

    if not from_node or not to_node:
        return jsonify({"error": "Missing edge connections"}), 400

    edge_id = str(uuid.uuid4())

    try:
        with get_db_connection() as conn:
            conn.execute(
                "INSERT INTO edges (id, from_node, to_node) VALUES (?, ?, ?)",
                (edge_id, from_node, to_node),
            )
            conn.commit()
    except sqlite3.IntegrityError:
        return (
            jsonify({"error": "Foreign key constraint failure or invalid data"}),
            400,
        )

    return jsonify({"id": edge_id, "from_node": from_node, "to_node": to_node}), 201


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=True)