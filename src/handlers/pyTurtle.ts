import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import { createLayoutSandbox, sanitizeSvgToElement } from "./layoutSanitizer.ts";

// hardcoded limits to prevent big SVG crash
const MAX_ELEMENTS = 750;
const MAX_POINTS_PER_PATH = 150;
const MAX_TOTAL_POINTS = 20000;
// note those are good for the browser,and python limits, not your editor/lsp. this might generate a 25,000 line python code :)

interface TurtlePoint {
  x: number;
  y: number;
}

interface TurtlePathShape {
  type: "path";
  points: TurtlePoint[];
  fill: string | null;
  stroke: string | null;
  sw: number;
}

interface TurtleCircleShape {
  type: "circle";
  x: number;
  y: number;
  r: number;
  fill: string | null;
  stroke: string | null;
  sw: number;
}

type TurtleShape = TurtlePathShape | TurtleCircleShape;

async function waitForLayoutCycle (): Promise<void> {
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

class pyTurtleHandler implements FormatHandler {
  public name: string = "pyturtle";
  public supportedFormats?: FileFormat[];
  public ready: boolean = false;

  async init () {
    this.supportedFormats = [
      {
        name: "Python Turtle program",
        format: "py",
        extension: "py",
        mime: "text/x-python",
        from: false,
        to: true,
        internal: "pyTurtle",
        category: "code",
        lossless: false // this is a lossy conversion, as not all svg features are supported, and some details are lost in the conversion to turtle commands
      },
      CommonFormats.SVG.builder("svg").allowFrom()
    ];
    this.ready = true;
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {

    if (inputFormat.internal !== "svg") {
      throw new Error(`pyTurtle handler expected svg input, received ${inputFormat.internal}.`);
    }
    if (outputFormat.internal !== "pyTurtle") {
      throw new Error(`pyTurtle handler expected pyTurtle output, received ${outputFormat.internal}.`);
    }

    const outputFiles: FileData[] = [];

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    for (const inputFile of inputFiles) {
      const { name, bytes } = inputFile;
      const svgText = decoder.decode(bytes);
      const sandbox = createLayoutSandbox();

      try {
        const svgEl = sanitizeSvgToElement(svgText);
        sandbox.container.replaceChildren(svgEl);
        await waitForLayoutCycle();

        const pythonCode = pyTurtleHandler.convert_program(svgEl);
        const outputBytes = encoder.encode(pythonCode);
        const newName = name.split(".")[0] + ".py";
        outputFiles.push({ name: newName, bytes: outputBytes });
      } finally {
        sandbox.cleanup();
      }
    }

    return outputFiles;

  }

  static convert_program (svgEl: SVGSVGElement) {

    let elements: SVGGeometryElement[] = Array.from(svgEl.querySelectorAll("path, circle, rect, ellipse, line, polyline, polygon"));
    if (elements.length > MAX_ELEMENTS) {
      elements = elements.slice(0, MAX_ELEMENTS);
    }
    const pt = svgEl.createSVGPoint(); // this API is deprecated

    const formatColor = (col: string) => {
      if (!col || col === "none" || col === "transparent") return null;
      if (col.startsWith("rgb")) {
        const rgb = col.match(/\d+/g);
        return "#" + rgb!.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, "0")).join("");
      }
      return col;
    };

    const allPoints: TurtlePoint[] = [];
    const shapeData: TurtleShape[] = [];
    // safe min/max, that better scale then Math
    const safeMin = (arr: number[]) => { let m = Infinity; for (const v of arr) if (v < m) m = v; return m; };
    const safeMax = (arr: number[]) => { let m = -Infinity; for (const v of arr) if (v > m) m = v; return m; };

    for (const el of elements) {

      if (allPoints.length >= MAX_TOTAL_POINTS) {
        break;
      }

      const style = window.getComputedStyle(el);
      const fill = formatColor(el.getAttribute("fill") || style.fill);
      const stroke = formatColor(el.getAttribute("stroke") || style.stroke);
      const sw = parseFloat(el.getAttribute("stroke-width") || style.strokeWidth || "1");
      const ctm = el.getScreenCTM();
      if (!ctm) continue;

      const tagName = el.tagName.toLowerCase();

      if (tagName === "circle" || tagName === "ellipse") {
        // native circle support
        const b = el.getBBox();
        const rx = b.width / 2;
        const ry = b.height / 2;
        const cx = b.x + rx;
        const cy = b.y + ry;

        // Move to the bottom of the circle for Turtle's .circle()
        pt.x = cx;
        pt.y = cy + ry;
        const startTrans = pt.matrixTransform(ctm);

        shapeData.push({
          type: "circle",
          x: startTrans.x,
          y: -startTrans.y,
          r: rx,
          fill,
          stroke,
          sw
        });

        allPoints.push({ x: startTrans.x, y: -startTrans.y });
      } else {
        // all other, convert to goto calls
        let subPaths: Array<string | SVGGeometryElement> = [];
        if (tagName === "path") {
          const d = el.getAttribute("d");
          if (d === null) continue;
          subPaths = d.split(/(?=[Mm])/).filter(s => s.trim());
        } else {
          subPaths = [el];
        }

        for (const seg of subPaths) {
          if (allPoints.length >= MAX_TOTAL_POINTS) break;

          let pts: TurtlePoint[] = [];

          if (tagName === "path" || tagName === "polyline" || tagName === "polygon") {
            let sampledGeometry: SVGGeometryElement = el;
            let cleanupGeometry = () => { };

            if (tagName === "path") {
              const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
              tempPath.setAttribute("d", String(seg));
              svgEl.appendChild(tempPath);
              sampledGeometry = tempPath;
              cleanupGeometry = () => {
                tempPath.remove();
              };
            }

            try {
              const len = sampledGeometry.getTotalLength();
              const step = Math.max(len / MAX_POINTS_PER_PATH, 0.5);
              for (let i = 0; i <= len; i += step) {
                const pos = sampledGeometry.getPointAtLength(i);
                pt.x = pos.x;
                pt.y = pos.y;
                const trans = pt.matrixTransform(ctm);
                pts.push({ x: trans.x, y: -trans.y });
              }
            } finally {
              cleanupGeometry();
            }
          } else {
            const b = el.getBBox();
            const corners = [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y }, { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height }];
            corners.forEach(c => {
              pt.x = c.x;
              pt.y = c.y;
              const trans = pt.matrixTransform(ctm);
              pts.push({ x: trans.x, y: -trans.y });
            });
          }

          if (pts.length > 0) {
            const remainingBudget = MAX_TOTAL_POINTS - allPoints.length;
            const boundedPoints = pts.slice(0, Math.max(remainingBudget, 0));
            if (boundedPoints.length === 0) {
              continue;
            }

            allPoints.push(...boundedPoints);
            shapeData.push({ type: "path", points: boundedPoints, fill, stroke, sw });
          }
        }
      }
    }

    const xs = allPoints.map(p => p.x);
    const ys = allPoints.map(p => p.y);
    const minX = safeMin(xs);
    const maxX = safeMax(xs);
    const minY = safeMin(ys);
    const maxY = safeMax(ys);
    const padding = Math.max(maxX - minX, maxY - minY) * 0.1;

    // build python program. this is inefficient (just like svg), and ignore options like loops
    let py = "import turtle\n\n";
    py += "s = turtle.Screen()\nt = turtle.Turtle()\nt.speed(0)\nturtle.tracer(0, 0)\n";
    if (isFinite(padding) && isFinite(minX) && isFinite(minY) && isFinite(maxY))
      py += `s.setworldcoordinates(${minX - padding}, ${minY - padding}, ${maxX + padding}, ${maxY + padding})\n\n`;

    for (const shape of shapeData) {

      py += `t.penup()\nt.pensize(${shape.sw})\nt.pencolor("${shape.stroke || "black"}")\n`;
      if (shape.fill) py += "t.fillcolor(\"" + shape.fill + "\")\n";

      if (shape.type === "circle") {
        py += `t.goto(${shape.x.toFixed(2)}, ${shape.y.toFixed(2)})\nt.setheading(0)\n`;
        if (shape.fill) py += "t.begin_fill()\n";
        py += `t.circle(${shape.r.toFixed(2)})\n`;
        if (shape.fill) py += "t.end_fill()\n";
      } else {
        if (shape.fill) py += "t.begin_fill()\n";

        py += `t.goto(${shape.points[0].x.toFixed(2)}, ${shape.points[0].y.toFixed(2)})\nt.pendown()\n`;
        for (let i = 1; i < shape.points.length; i++) {
          py += `t.goto(${shape.points[i].x.toFixed(2)}, ${shape.points[i].y.toFixed(2)})\n`;
        }
        // close after each shape, to prevent fill colliding
        py += `t.goto(${shape.points[0].x.toFixed(2)}, ${shape.points[0].y.toFixed(2)})\n`;
        if (shape.fill) py += "t.end_fill()\n";
      }
      py += "t.penup()\n\n";
    }

    py += "t.hideturtle()\nturtle.update()\nturtle.done()";
    return py;
  }


}

export default pyTurtleHandler;
