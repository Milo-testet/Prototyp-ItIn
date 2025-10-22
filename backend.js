document.getElementById("downloadPdfBtn").addEventListener("click", () => {
    const pdfPath = "folder/ExoGrid-Exosuit-Spezifikation.pdf"; // Pfad zur PDF im Projekt
    const link = document.createElement("a");
    link.href = pdfPath;
    link.download = "ExoGrid-Exosuit-Spezifikation.pdf"; // Name der Datei beim Download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});