const playwright = require('playwright');
const fs = require('fs').promises;
const path = require('path');

const folderPath = path.join(__dirname, 'carreras');


// Se crea la carpeta 'carreras' y hacemos que exista  si o si puta
fs.mkdir(folderPath, { recursive: true }).catch(console.error);

async function extractCareerLinks() {
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();

    await page.goto('https://soft.uasd.edu.do/planesgrado/');

    const careerLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.tvCarreras_0[target="_blank"]')).map(link => ({
            title: link.innerText,
            url: link.href,
        }));
    });

    for (const career of careerLinks) {
        const data = await savePensumData(browser, career);
        await fs.writeFile(path.join(folderPath, `${data.name}.json`), JSON.stringify(data.data, null, 2));
    }

    console.log('Todos los datos del pemsun han sido guardados.');
    await browser.close();
}


const savePensumData = async (browser, carrera) => {

    const page = await browser.newPage();
    await page.goto(carrera.url, { waitUntil: 'networkidle' });

    const data = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#datosPrincipales tr'));
        let semester = '';
        const tableData = [];

        for (const row of rows) {
            if (row.cells.length === 1) {
                semester = row.innerText.trim();
            } else if (row.cells.length > 1) {
                const [clave, asignatura, ht, hp, cr, prerequisitos, equivalencias] = Array.from(row.cells, cell => cell.innerText.trim());
                tableData.push({
                    semester,
                    clave,
                    asignatura,
                    ht,
                    hp,
                    cr,
                    prerequisitos,
                    equivalencias,
                });
            }
        }
        return tableData;
    });

    // Formatear el título de la carrera para el nombre del archivo
    const title = carrera.title.replace(/ /g, '_').toLowerCase();
    return { data, name: title };
}

extractCareerLinks().catch(console.error);
// TODO Hacerlo mas optimo rendimiento actual por debajo de la media

