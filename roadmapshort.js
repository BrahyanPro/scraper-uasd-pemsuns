const playwright = require('playwright')
const fs = require('fs').promises
const path = require('path')

const folderPath = path.join(__dirname, 'carreras')
const CACHE_FILE = path.join(__dirname, 'carreras', 'career_data_cache.json')

async function saveCareerDataCache (careerData) {
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true })
    await fs.writeFile(CACHE_FILE, JSON.stringify(careerData, null, 2))
    console.log('Datos de carreras guardados en caché.')
  } catch (error) {
    console.error('Error al guardar los datos en caché:', error)
  }
}

async function loadCareerDataCache () {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8')
    console.log('Datos de carreras cargados desde caché.')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No se encontró caché de datos de carreras.')
    } else {
      console.error('Error al cargar los datos desde caché:', error)
    }
    return null
  }
}

async function analyzeCareerData () {
  console.time('Tiempo de ejecución')

  let careerData = await loadCareerDataCache()

  if (!careerData) {
    const browser = await playwright.chromium.launch()
    const page = await browser.newPage()

    try {
      await page.goto('https://soft.uasd.edu.do/planesgrado/')

      console.log('Extrayendo datos de facultades...')
      const faculties = await extractFacultiesData(page)

      console.log('Extrayendo detalles de carreras...')
      careerData = await extractCareerDetails(browser, faculties)

      console.log('Guardando datos de carreras en caché...')
      await saveCareerDataCache(careerData)
    } catch (error) {
      console.error('Error durante la extracción de datos:', error)
    } finally {
      console.log('Cerrando el navegador...')
      await browser.close()
    }
  }

  if (careerData) {
    console.log('Procesando datos de carreras...')
    const processedData = processCareerData(careerData)
    console.log('Optimizando duración de carreras...')
    const optimizedData = optimizeCareerDurations(processedData)
    console.log('Guardando análisis en archivo...')
    await saveAnalysisToFile(optimizedData)
    console.log('Imprimiendo carreras más cortas...')
    printTopShortestCareers(optimizedData)

    console.log('Análisis completado.')
  } else {
    console.error('No se pudieron obtener los datos de las carreras.')
  }

  console.timeEnd('Tiempo de ejecución')
}

async function extractFacultiesData (page) {
  return await page.evaluate(() => {
    const div = document.querySelector('.tree#tvCarreras')
    const tables = div.querySelectorAll(':scope > table')

    function getSchoolsData (schools) {
      const schoolData = []
      const tables = schools.querySelectorAll(':scope > table')
      tables.forEach(table => {
        const schoolName = table.querySelector('.tvCarreras_0').innerText
        const nextSibling = table.nextElementSibling
        const careers = Array.from(
          nextSibling.querySelectorAll('.tvCarreras_0[target="_blank"]')
        ).map(link => ({ title: link.innerText, url: link.href }))
        schoolData.push({ name: schoolName, careers })
      })
      return schoolData
    }

    return Array.from(tables).map(table => {
      const facultyName = table.querySelector('.tvCarreras_0').innerText
      const schools = getSchoolsData(table.nextElementSibling)
      return { faculty: facultyName, data: schools }
    })
  })
}

async function extractCareerDetails (browser, faculties) {
  const careerData = []
  for (const faculty of faculties) {
    console.log(`Analizando facultad: ${faculty.faculty}`)
    for (const school of faculty.data) {
      console.log(`  Escuela: ${school.name}`)
      for (const career of school.careers) {
        console.log(`    Carrera: ${career.title}`)
        try {
          const details = await getCareerDetails(browser, career, faculty.faculty, school.name)
          careerData.push(details)
        } catch (error) {
          console.error(`Error al obtener detalles de ${career.title}:`, error)
        }
      }
    }
  }
  return careerData
}

async function getCareerDetails (browser, career, facultyName, schoolName) {
  const page = await browser.newPage()
  await page.goto(career.url, { waitUntil: 'networkidle' })

  const details = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#datosPrincipales tr'))
    let currentSemester = ''
    const subjects = []

    for (const row of rows) {
      if (row.cells.length === 1) {
        currentSemester = row.innerText.trim()
      } else if (row.cells.length > 1) {
        const [clave, asignatura, _ht, _hp, cr, prerequisitos] = Array.from(row.cells, cell => cell.innerText.trim())
        console.log('Actualmente en la', clave, asignatura, _ht, _hp, cr, prerequisitos)
        if (!isNaN(cr)) {
          subjects.push({
            semester: currentSemester,
            code: clave,
            name: asignatura,
            credits: parseInt(cr),
            prerequisites: prerequisitos
          })
        }
      }
    }

    return { subjects }
  })

  await page.close()

  return {
    title: career.title,
    faculty: facultyName,
    school: schoolName,
    ...details
  }
}

function processCareerData (careerData) {
  const basicCycleNames = [
    'Lengua Española Básica I',
    'Lengua Española Básica II',
    'Int A La Filosofía',
    'Introd A Las Ciencias Sociales',
    'Orientación Institucional',
    'Fund De His Social Dominicana'
  ]

  return careerData.map(career => {
    const validSubjects = career.subjects.filter(subject => subject.code && subject.name)

    const subjectsMap = new Map()

    validSubjects.forEach(subject => {
      subject.prerequisites = subject.prerequisites ? subject.prerequisites.replace(/[()]/g, '').trim().toUpperCase() : ''
      subject.code = subject.code.trim().toUpperCase()
      subject.isBasicCycle = basicCycleNames.includes(subject.name)
      subjectsMap.set(subject.code, subject)
    })

    const totalCredits = validSubjects.reduce((sum, subject) => sum + subject.credits, 0)
    const semesters = new Set(validSubjects.map(subject => subject.semester)).size

    return {
      ...career,
      subjects: validSubjects,
      totalCredits,
      semesters,
      subjectsMap
    }
  })
}

function optimizeCareerDurations (careerData) {
  console.log(`Optimizando ${careerData.length} carreras...`)
  return careerData.map((career, index) => {
    console.log(`Optimizando carrera ${index + 1} de ${careerData.length}: ${career.title}`)
    let careerSubjects = career.subjects.filter(subject => !subject.isBasicCycle)
    const completedSubjects = new Set()
    let semesters = 0
    let totalCredits = 0
    const maxSemesters = 20 // limite maximo de semestres (10 años)

    while (careerSubjects.length > 0 && semesters < maxSemesters) {
      semesters++
      let semesterCredits = 0
      const semesterSubjects = []

      const isSummerTerm = (semesters % 3) === 0
      const maxCredits = isSummerTerm ? 12 : 30
      const maxSubjects = isSummerTerm ? 3 : Infinity

      let availableSubjects = [...careerSubjects]

      availableSubjects = availableSubjects.filter(subject =>
        isSubjectAvailable(subject, completedSubjects, career.subjectsMap) &&
        semesterCredits + subject.credits <= maxCredits
      )

      while (semesterCredits < maxCredits && semesterSubjects.length < maxSubjects && availableSubjects.length > 0) {
        const subject = availableSubjects.shift()
        addSubjectToSemester(subject, semesterSubjects, completedSubjects)
        semesterCredits += subject.credits
        totalCredits += subject.credits
        careerSubjects = careerSubjects.filter(s => s !== subject)
        availableSubjects = [...careerSubjects]
          .filter(s =>
            isSubjectAvailable(s, completedSubjects, career.subjectsMap) &&
            semesterCredits + s.credits <= maxCredits
          )
      }

      if (semesterSubjects.length === 0) {
        console.log(`No se pudieron programar materias en el semestre ${semesters}. El estudiante no puede avanzar más.`)
        break
      }
    }

    const years = (semesters / 3).toFixed(1)
    console.log(`Carrera: ${career.title}, Semestres: ${semesters}, Años: ${years}, Créditos totales: ${totalCredits}`)
    return { ...career, optimizedSemesters: semesters, optimizedYears: parseFloat(years), totalCredits }
  })
}

function isSubjectAvailable (subject, completedSubjects, subjectsMap) {
  if (!subject.prerequisites || subject.prerequisites === '-' || subject.prerequisites === '') {
    return true
  }

  return subject.prerequisites.split(',').every(reqGroup => {
    return reqGroup.split('/').some(prereq => {
      const code = prereq.trim().toUpperCase()
      return subjectsMap.has(code) && completedSubjects.has(code)
    })
  })
}

function addSubjectToSemester (subject, semesterSubjects, completedSubjects) {
  semesterSubjects.push(subject)
  completedSubjects.add(subject.code)
}

function printTopShortestCareers (careerData) {
  const sortedCareers = careerData.sort((a, b) => a.optimizedYears - b.optimizedYears).slice(0, 15)

  console.log('\n\x1b[1mLas 15 carreras de menor duración (optimizadas):\x1b[0m')
  console.log('╔════════════════════════════════════════════════════════════════╦══════════════════════╦══════════════════════╦═══════════╦═══════╗')
  console.log('║ \x1b[1mCarrera\x1b[0m                                                    ║ \x1b[1mFacultad\x1b[0m            ║ \x1b[1mEscuela\x1b[0m             ║ \x1b[1mSemestres\x1b[0m ║ \x1b[1mAños\x1b[0m  ║')
  console.log('╠════════════════════════════════════════════════════════════════╬══════════════════════╬══════════════════════╬═══════════╬═══════╣')

  sortedCareers.forEach((career, index) => {
    console.log(
      `║ ${padRight(career.title, 60)} ║ ${padRight(career.faculty, 20)} ║ ${padRight(career.school, 20)} ║ ${padCenter(career.optimizedSemesters.toString(), 9)} ║ ${padCenter(career.optimizedYears.toString(), 5)} ║`
    )

    if (index < sortedCareers.length - 1) {
      console.log('╠════════════════════════════════════════════════════════════════╬══════════════════════╬══════════════════════╬═══════════╬═══════╣')
    }
  })

  console.log('╚════════════════════════════════════════════════════════════════╩══════════════════════╩══════════════════════╩═══════════╩═══════╝')
}

function padRight (str, length) {
  return str.length > length ? str.slice(0, length - 3) + '...' : str.padEnd(length)
}

function padCenter (str, length) {
  const spaces = length - str.length
  const padLeft = Math.floor(spaces / 2)
  const padRight = spaces - padLeft
  return ' '.repeat(padLeft) + str + ' '.repeat(padRight)
}

async function saveAnalysisToFile (analysis) {
  const filePath = path.join(folderPath, 'optimized_career_analysis.json')
  await fs.mkdir(folderPath, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(analysis, null, 2))
  console.log(`Análisis guardado en: ${filePath}`)
}

analyzeCareerData().then(() => {
  console.log('Proceso completado exitosamente.')
}).catch(error => {
  console.error('Error en el proceso principal:', error)
}).finally(() => {
  console.log('Programa terminado.')
})
