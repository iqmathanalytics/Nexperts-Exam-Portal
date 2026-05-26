# Certificate background

Place your Canva export here:

```
api/assets/certificate-template.png
```

Recommended: **842 × 595 px** (A4 landscape) or the same aspect ratio.

The API draws all text on top of your artwork (logo and seal stay on the background). No manual field positions are required.

## Text rendered automatically

- Certificate of Achievement (header)
- Recipient name (auto-sized)
- Exam title and description
- **Score percentage** in a gold circular badge with tier label (e.g. Outstanding / Excellent)
- Credential ID, issue date, verification line

## Adjust positions

Edit `api/src/services/pdf-certificate.ts` → `renderCertificateContent()` if any text overlaps your design. Key `y` values: header `118`, name `172`, exam title `258`, score badge centre `368`, footer `pageH - 78`.

Restart the API after changes.
