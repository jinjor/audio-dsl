import { Position, Range } from "./ast";
import chalk from "chalk";

const error = chalk.keyword("crimson");

export class Reporter {
  private lines: string[] | null = null;
  constructor(private source: string) {}
  private getLines(): string[] {
    if (this.lines == null) {
      this.lines = this.source.split("\n");
    }
    return this.lines;
  }
  private colorLine(
    line: string,
    startChar: number | null,
    endChar: number | null
  ) {
    startChar = startChar ?? 0;
    endChar = endChar ?? line.length;
    return (
      line.slice(0, startChar) +
      error(line.slice(startChar, endChar)) +
      line.slice(endChar)
    );
  }
  reportSyntaxError(message: string, position: Position): string {
    const lines = this.getLines();
    const margin = 0;
    const marginedStartLine = Math.max(position.line - margin, 0);
    const marginedEndLine = Math.min(position.line + 1 + margin, lines.length);
    let text = "";
    text += `${message}\n`;
    text += "\n";
    for (let l = marginedStartLine; l < marginedEndLine; l++) {
      const line = lines[l];
      const hasError = position.line == l;
      if (hasError) {
        const startChar = position.character;
        const endChar = position.character;
        const coloredLine = this.colorLine(line, startChar, endChar);
        text += `${String(l + 1).padStart(5)}|> ${coloredLine}\n`;
      } else {
        text += `${String(l + 1).padStart(5)}|  ${line}\n`;
      }
    }
    return text;
  }
  reportValidationError(message: string, { start, end }: Range): string {
    const lines = this.getLines();
    const margin = 0;
    const marginedStartLine = Math.max(start.line - margin, 0);
    const marginedEndLine = Math.min(end.line + 1 + margin, lines.length);
    let text = "";
    text += `${message}\n`;
    text += "\n";
    for (let l = marginedStartLine; l < marginedEndLine; l++) {
      const line = lines[l];
      const isInError = start.line <= l && l <= end.line;
      if (isInError) {
        const startChar = start.line === l ? start.character : null;
        const endChar = end.line === l ? end.character : null;
        const coloredLine = this.colorLine(line, startChar, endChar);
        text += `${String(l + 1).padStart(5)}|> ${coloredLine}\n`;
      } else {
        text += `${String(l + 1).padStart(5)}|  ${line}\n`;
      }
    }
    return text;
  }
}
