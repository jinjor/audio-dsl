/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";

suite("Should get diagnostics", () => {
  test("works", async () => {
    const docUri = getDocUri("diagnostics.dsl");
    await activate(docUri);
    const actualDiagnostics = vscode.languages.getDiagnostics(docUri);
    assert(actualDiagnostics.length >= 1);
  });
});
