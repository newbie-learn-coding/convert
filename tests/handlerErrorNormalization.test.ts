import { expect, test } from "bun:test";
import type { FileFormat } from "../src/FormatHandler.ts";
import pyTurtleHandler from "../src/handlers/pyTurtle.ts";
import svgForeignObjectHandler from "../src/handlers/svgForeignObject.ts";

const htmlFormat: FileFormat = {
  name: "HTML",
  format: "html",
  extension: "html",
  mime: "text/html",
  from: true,
  to: true,
  internal: "html",
  category: "document",
  lossless: true
};

const svgFormat: FileFormat = {
  name: "SVG",
  format: "svg",
  extension: "svg",
  mime: "image/svg+xml",
  from: true,
  to: true,
  internal: "svg",
  category: "image",
  lossless: true
};

const pyTurtleFormat: FileFormat = {
  name: "pyTurtle",
  format: "py",
  extension: "py",
  mime: "text/x-python",
  from: false,
  to: true,
  internal: "pyTurtle",
  category: "code",
  lossless: false
};

test("svgForeignObject rejects invalid input with Error", async () => {
  const handler = new svgForeignObjectHandler();
  await expect(handler.doConvert([], svgFormat, svgFormat)).rejects.toThrow("expected html input");
});

test("svgForeignObject rejects invalid output with Error", async () => {
  const handler = new svgForeignObjectHandler();
  await expect(handler.doConvert([], htmlFormat, htmlFormat)).rejects.toThrow("expected svg output");
});

test("pyTurtle rejects invalid input with Error", async () => {
  const handler = new pyTurtleHandler();
  await expect(handler.doConvert([], htmlFormat, pyTurtleFormat)).rejects.toThrow("expected svg input");
});

test("pyTurtle rejects invalid output with Error", async () => {
  const handler = new pyTurtleHandler();
  await expect(handler.doConvert([], svgFormat, svgFormat)).rejects.toThrow("expected pyTurtle output");
});
