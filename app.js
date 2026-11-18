const upload = document.getElementById("pdfUpload");
const canvas = document.getElementById("pdfCanvas");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");

upload.addEventListener("change", async (event) => {

    const file = event.target.files[0];

    if (!file) return;

    status.textContent = `Loading ${file.name}...`;

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;

    status.textContent =
        `Loaded ${file.name} (${pdf.numPages} pages)`;

    const page = await pdf.getPage(1);

    const viewport = page.getViewport({
        scale: 1.5
    });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
        canvasContext: ctx,
        viewport: viewport
    }).promise;

});
