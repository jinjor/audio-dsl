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
    startColumn: number | null,
    endColumn: number | null
  ) {
    startColumn = startColumn ?? 1;
    endColumn = endColumn ?? line.length;
    return (
      line.slice(0, startColumn - 1) +
      error(line.slice(startColumn - 1, endColumn)) +
      line.slice(endColumn)
    );
  }
  reportSyntaxError(message: string, position: Position): string {
    const lines = this.getLines();
    const margin = 0;
    const marginedStartRow = Math.max(position.row - margin, 1);
    const marginedEndRow = Math.min(position.row + margin, lines.length);
    let text = "";
    text += `${message}\n`;
    text += "\n";
    for (let r = marginedStartRow; r <= marginedEndRow; r++) {
      const line = lines[r - 1];
      const hasError = position.row == r;
      if (hasError) {
        const startColumn = position.column;
        const endColumn = position.column;
        const coloredLine = this.colorLine(line, startColumn, endColumn);
        text += `${String(r).padStart(5)}|> ${coloredLine}\n`;
      } else {
        text += `${String(r).padStart(5)}|  ${line}\n`;
      }
    }
    return text;
  }
  reportValidationError(message: string, { start, end }: Range): string {
    const lines = this.getLines();
    const margin = 0;
    const marginedStartRow = Math.max(start.row - margin, 1);
    const marginedEndRow = Math.min(end.row + margin, lines.length);
    let text = "";
    text += `${message}\n`;
    text += "\n";
    for (let r = marginedStartRow; r <= marginedEndRow; r++) {
      const line = lines[r - 1];
      const isInError = start.row <= r && r <= end.row;
      if (isInError) {
        const startColumn = start.row === r ? start.column : null;
        const endColumn = end.row === r ? end.column : null;
        const coloredLine = this.colorLine(line, startColumn, endColumn);
        text += `${String(r).padStart(5)}|> ${coloredLine}\n`;
      } else {
        text += `${String(r).padStart(5)}|  ${line}\n`;
      }
    }
    return text;
  }
}
