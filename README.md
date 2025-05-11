# pdf-service

Generate PDFs of paywalled articles.

## Usage

```bash
docker build --platform linux/amd64 -t pdf-service.
docker run -p 3000:3000 pdf-service
```

Navigate to `localhost:3000/?url=<YOUR_ARTICLE_URL>` to download the PDF.
