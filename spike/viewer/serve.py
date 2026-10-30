"""Static server for the viewer spike that also records results.

Serves spike/viewer/ and, when given, a media folder at /media/. The page POSTs
its numbers to /results; each one is appended as a JSON line to the results
file, so runs in different browsers end up in one place.

Usage: python3 serve.py [--port 5173] [--media ../../media]
"""
import argparse
import json
import os
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))


class Handler(SimpleHTTPRequestHandler):
    media_dir = None
    results_path = None

    def translate_path(self, path):
        if self.media_dir and path.startswith("/media/"):
            rel = path[len("/media/"):].split("?", 1)[0]
            return os.path.join(self.media_dir, *rel.split("/"))
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path.startswith("/shot?name="):
            name = os.path.basename(self.path.split("=", 1)[1]) + ".png"
            samples = os.path.join(self.media_dir, "samples")
            os.makedirs(samples, exist_ok=True)
            with open(os.path.join(samples, name), "wb") as f:
                f.write(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            print("shot:", name)
            self.send_response(204)
            self.end_headers()
            return
        if self.path != "/results":
            self.send_error(404)
            return
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        record = json.loads(body)
        record["receivedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with open(self.results_path, "a") as f:
            f.write(json.dumps(record) + "\n")
        print("result:", json.dumps(record))
        self.send_response(204)
        self.end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5173)
    parser.add_argument("--media", default=os.path.join(HERE, "..", "..", "media"))
    args = parser.parse_args()

    media = os.path.abspath(args.media)
    os.makedirs(media, exist_ok=True)
    Handler.media_dir = media
    Handler.results_path = os.path.join(media, "spike-results.jsonl")

    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=HERE))
    print(f"serving {HERE} on http://localhost:{args.port}, results to {Handler.results_path}")
    server.serve_forever()


if __name__ == "__main__":
    main()
