import { jsPDF } from "jspdf";
import { pdfCache } from "./pdfCache";

export const generateMangaPDF = async (
  title: string,
  chapterNumber: string | number,
  images: string[],
  onProgress?: (percent: number) => void
) => {
  const chapters = [{ number: chapterNumber, images }];
  const cached = await pdfCache.get(chapters, "high");

  if (cached) {
    console.log("PDF recuperado del cach? instant?neamente");
    onProgress?.(100);
    downloadBlob(cached.blob, cached.filename);
    return;
  }

  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();

  for (let i = 0; i < images.length; i += 1) {
    onProgress?.(Math.round(((i + 1) / images.length) * 100));

    const imgData = await getImageData(images[i]);
    const imgProps = pdf.getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    if (i > 0) pdf.addPage([pdfWidth, pdfHeight], "p");
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
  }

  const filename = `${sanitizeFilename(title)}_Cap_${sanitizeFilename(String(chapterNumber))}.pdf`;
  const pdfBlob = pdf.output("blob");

  await pdfCache.set(chapters, "high", pdfBlob, filename);
  downloadBlob(pdfBlob, filename);
};

function sanitizeFilename(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .replace(/\s+/g, "_") || "mangastoon";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const getImageData = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context unavailable."));
        return;
      }

      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = url.includes("dashboard.olympusbiblioteca.com") || url.startsWith("/api/proxy-image")
      ? url
      : `/api/proxy-image?url=${encodeURIComponent(url)}`;
  });
};
