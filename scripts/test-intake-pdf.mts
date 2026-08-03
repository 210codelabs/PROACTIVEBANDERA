import { FORMS } from "../src/lib/intake/forms";
import { renderFormPdf } from "../src/lib/intake/pdf";
import fs from "fs";

async function main() {
  for (const f of FORMS) {
    const bytes = await renderFormPdf(f);
    const out = `/tmp/${f.slug}.pdf`;
    fs.writeFileSync(out, Buffer.from(bytes));
    console.log(`OK ${f.slug} -> ${out} (${bytes.length} bytes)`);
  }
}
main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
