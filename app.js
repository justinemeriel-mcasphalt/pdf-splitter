pdfjsLib.GlobalWorkerOptions.workerSrc =
'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const upload = document.getElementById("pdfUpload");
const pdfCanvas = document.getElementById("pdfCanvas");
const overlayCanvas = document.getElementById("overlayCanvas");

const pdfCtx = pdfCanvas.getContext("2d");
const overlayCtx = overlayCanvas.getContext("2d");

const statusLabel = document.getElementById("status");
const extractBtn = document.getElementById("extractBtn");
const downloadBtn = document.getElementById("downloadBtn");

const nameTableBody =
document.querySelector("#nameTable tbody");

let pdfDocument = null;
let pdfBytes = null;

let rect = null;

let dragging = false;
let startX;
let startY;

upload.addEventListener("change", async (e) => {

    const file = e.target.files[0];

    if (!file) return;

    pdfBytes = await file.arrayBuffer();

    pdfDocument = await pdfjsLib.getDocument({
        data: pdfBytes
    }).promise;

    statusLabel.textContent =
        `Loaded ${pdfDocument.numPages} pages`;

    await renderFirstPage();

    extractBtn.disabled = false;
});

async function renderFirstPage() {

    const page = await pdfDocument.getPage(1);

    const viewport = page.getViewport({
        scale: 1.5
    });

    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;

    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;

    await page.render({
        canvasContext: pdfCtx,
        viewport: viewport
    }).promise;
}

overlayCanvas.addEventListener("mousedown", (e) => {

    startX = e.offsetX;
    startY = e.offsetY;

    dragging = true;
});

overlayCanvas.addEventListener("mousemove", (e) => {

    if (!dragging) return;

    overlayCtx.clearRect(
        0,
        0,
        overlayCanvas.width,
        overlayCanvas.height
    );

    const width = e.offsetX - startX;
    const height = e.offsetY - startY;

    overlayCtx.strokeStyle = "red";
    overlayCtx.lineWidth = 2;

    overlayCtx.strokeRect(
        startX,
        startY,
        width,
        height
    );
});

overlayCanvas.addEventListener("mouseup", (e) => {

    dragging = false;

    rect = {

        x: Math.min(startX, e.offsetX),

        y: Math.min(startY, e.offsetY),

        width: Math.abs(e.offsetX - startX),

        height: Math.abs(e.offsetY - startY)

    };

    console.log(rect);
});

extractBtn.addEventListener("click",
async () => {

    if (!rect) {

        alert("Draw a rectangle first.");

        return;
    }

    statusLabel.textContent =
        "Running OCR...";

    nameTableBody.innerHTML = "";

    const names = [];

    for (
        let pageNumber = 1;
        pageNumber <= pdfDocument.numPages;
        pageNumber++
    ) {

        statusLabel.textContent =
        `OCR Page ${pageNumber} of ${pdfDocument.numPages}`;

        const page =
            await pdfDocument.getPage(pageNumber);

        const viewport =
            page.getViewport({
                scale: 1.5
            });

        const tempCanvas =
            document.createElement("canvas");

        const tempCtx =
            tempCanvas.getContext("2d");

        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;

        await page.render({
            canvasContext: tempCtx,
            viewport: viewport
        }).promise;

        //-------------------------------------
        // Create enlarged crop
        //-------------------------------------
        
        const crop =
            document.createElement("canvas");
        
        const SCALE = 3;
        
        crop.width =
            Math.floor(rect.width * SCALE);
        
        crop.height =
            Math.floor(rect.height * SCALE);
        
        const cropCtx =
            crop.getContext("2d");
        
        // upscale while cropping
        
        cropCtx.drawImage(
            tempCanvas,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            0,
            0,
            crop.width,
            crop.height
        );
        
        //-------------------------------------
        // Convert to black/white
        //-------------------------------------
        
        const imageData =
            cropCtx.getImageData(
                0,
                0,
                crop.width,
                crop.height
            );
        
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
        
            const avg =
                (data[i] +
                 data[i + 1] +
                 data[i + 2]) / 3;
        
            const value =
                avg > 180 ? 255 : 0;
        
            data[i] =
            data[i + 1] =
            data[i + 2] =
                value;
        }
        
        cropCtx.putImageData(
            imageData,
            0,
            0
        );
        
        //-------------------------------------
        // OCR
        //-------------------------------------
        
        const result =
        await Tesseract.recognize(
            crop,
            "eng",
            {
                tessedit_pageseg_mode: 7,
                tessedit_char_whitelist:
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"
            }
        );

        let text =
            result.data.text
                .toUpperCase()
                .replace(/[^A-Z0-9-]/g, "")
                .trim();

        const match =
            text.match(
                /([A-Z]{5})[-]?([0-9]{3})/
            );
        
        if (match) {
        
            text =
                `${match[1]}-${match[2]}`;
        }
        else {
        
            text =
                sanitizeFilename(text);
        }


        if (!text) {
            text = `Page_${pageNumber}`;
        }

        names.push(text);

        addRow(pageNumber, text);
    }

    statusLabel.textContent =
        "OCR Complete";

    downloadBtn.disabled = false;
});

downloadBtn.addEventListener("click",
async () => {

    const pdfDoc =
        await PDFLib.PDFDocument.load(pdfBytes);

    const zip = new JSZip();

    const rows =
        document.querySelectorAll(
            "#nameTable tbody tr"
        );

    const filenames = [];

    rows.forEach(row => {

        filenames.push(

            row.querySelector("input").value

        );

    });

    for (
        let i = 0;
        i < pdfDoc.getPageCount();
        i++
    ) {

        const newPdf =
        await PDFLib.PDFDocument.create();

        const [copiedPage] =
        await newPdf.copyPages(
            pdfDoc,
            [i]
        );

        newPdf.addPage(copiedPage);

        const bytes =
            await newPdf.save();

        zip.file(
            filenames[i] + ".pdf",
            bytes
        );
    }

    const zipBlob =
        await zip.generateAsync({
            type: "blob"
        });

    const url =
        URL.createObjectURL(zipBlob);

    const a =
        document.createElement("a");

    a.href = url;

    a.download =
    "Renamed_PDFs.zip";

    a.click();
});

function addRow(page, text) {

    const row =
        document.createElement("tr");

    row.innerHTML = `
        <td>${page}</td>
        <td>
          <input value="${text}">
        </td>
    `;

    nameTableBody.appendChild(row);
}

function sanitizeFilename(text) {

    text = text
        .replace(/[<>:"/\\\\|?*]/g, "")
        .replace(/\s+/g, "_")
        .trim();

    return text;
}
