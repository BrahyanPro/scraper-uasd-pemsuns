const playwright = require('playwright')
const fs = require('fs').promises
const path = require('path')

const folderPath = path.join(__dirname, 'carreras')
fs.mkdir(folderPath, { recursive: true }).catch(console.error)

async function extractCareerLinks () {
  // init count time
  console.time('time')
  const browser = await playwright.chromium.launch()
  const page = await browser.newPage()
  await page.goto('https://soft.uasd.edu.do/planesgrado/')

  const faculties = await page.evaluate(() => {
    const div = document.querySelector('.tree#tvCarreras')
    const tables = div.querySelectorAll(':scope > table')
    const getSchoolsName = (schools) => {
      const schoolData = []
      const tables = schools.querySelectorAll(':scope > table')
      tables.forEach((table, index) => {
        const schoolName = table.querySelector('.tvCarreras_0').innerText
        const nextSibling = table.nextElementSibling
        const careers = Array.from(
          nextSibling.querySelectorAll('.tvCarreras_0[target="_blank"]'))
          .map(link => ({ title: link.innerText, url: link.href }))
        const data = {
          name: schoolName,
          careers
        }
        schoolData.push(data)
      })
      return schoolData
    }
    const data = []
    tables.forEach((table, index) => {
      const facultyName = table.querySelector('.tvCarreras_0').innerText
      const schools = getSchoolsName(table.nextElementSibling)
      const faculty = {
        faculty: facultyName,
        data: schools
      }
      data.push(faculty)
    })
    return data
  })
  for (const career of faculties) {
    // console.log color green
    console.log('\x1b[32m%s\x1b[0m',
      `Guardando datos de la facultad ${career.faculty}`)
    const faculty = career.faculty
    // Create a folder for the faculty
    const facultyFolder = path.join(folderPath, career.faculty)
    await fs.mkdir(facultyFolder, { recursive: true }).catch(console.error)

    for (const school of career.data) {
      console.log(`Guardando datos de ${school.name}`)
      for (const carrera of school.careers) {
        const data2 = {
          facultad: faculty,
          escuela: school.name
        }
        // console.log color yellow
        console.log('\x1b[33m%s\x1b[0m', `Guardando datos de la escuela ${data2.escuela}  ${data2.facultad}`)
        const { data, name } = await savePensumData(browser, carrera, data2)

        const filePath = path.join(facultyFolder, `${name}.json`)
        await fs.writeFile(filePath, JSON.stringify(data, null, 2))
          .catch(console.error)
        // console.log color blue
        console.log('\x1b[34m%s\x1b[0m', `Guardando datos de la carrera ${carrera.title}`)
      }
    }
  }
  // console.log color purple
  console.log('\x1b[35m%s\x1b[0m', 'Todos los datos del pemsun han sido guardados.')
  await browser.close()
  console.timeEnd('time')
}

const savePensumData = async (browser, carrera, data2) => {
  const page = await browser.newPage()
  await page.goto(carrera.url, { waitUntil: 'networkidle' })

  const data = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#datosPrincipales tr'))
    let semester = ''
    const tableData = []
    for (const row of rows) {
      if (row.cells.length === 1) {
        semester = row.innerText.trim()
      } else if (row.cells.length > 1) {
        const [clave, asignatura, ht, hp, cr, prerequisitos, equivalencias] = Array.from(
          row.cells,
          cell => cell.innerText.trim()
        )
        if (!clave) continue
        tableData.push({
          semester,
          clave,
          asignatura,
          horas_teoricas: ht,
          horas_practicas: hp,
          creditos: cr,
          prerequisitos,
          equivalencias
        })
      }
    }
    return tableData
  })
  const dataReady = data.map(item => ({ ...item, ...data2 }))
  // Formatear el título de la carrera para el nombre del archivo
  const title = carrera.title.replace(/[-/]/g, '_').toLowerCase()
  return { data: dataReady, name: title }
}

extractCareerLinks().catch(console.error)
