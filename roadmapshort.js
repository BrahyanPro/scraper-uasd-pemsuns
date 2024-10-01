const playwright = require('playwright')
const fs = require('fs').promises
const path = require('path')

const folderPath = path.join(__dirname, 'carreras')

const BASIC_CYCLE = [
  { name: 'Lengua Española II', credits: 3 },
  { name: 'Introducción a la Filosofía', credits: 3 },
  { name: 'Introducción a las Ciencias Sociales', credits: 3 },
  { name: 'Matemática Básica', credits: 4 },
  { name: 'Física Básica', credits: 4 },
  { name: 'Química Básica', credits: 3 },
  { name: 'Biología Básica', credits: 2 },
  { name: 'Orientación Institucional', credits: 1 },
  { name: 'Fundamentos de Historia Social Dominicana', credits: 3 },
  { name: 'Educación Física', credits: 2 }
]

async function analyzeCareerData () {
  console.time('Tiempo de ejecución')
  const browser = await playwright.chromium.launch()
  const page = await browser.newPage()
  await page.goto('https://soft.uasd.edu.do/planesgrado/')

  const faculties = await extractFacultiesData(page)
  const careerData = await extractCareerDetails(browser, faculties)

  await browser.close()

  const optimizedData = optimizeCareerDurations(careerData)
  await saveAnalysisToFile(optimizedData)
  printTopShortestCareers(optimizedData)

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
        const details = await getCareerDetails(browser, career, faculty.faculty, school.name)
        careerData.push(details)
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
        const [clave, asignatura, ht, hp, cr, prerequisitos] = Array.from(row.cells, cell => cell.innerText.trim())
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

function optimizeCareerDurations (careerData) {
  console.log(`Optimizando ${careerData.length} carreras...`)
  return careerData.map(career => {
    let remainingSubjects = [...BASIC_CYCLE, ...career.subjects]
    const completedSubjects = new Set()
    let semesters = 0
    let basicCycleCredits = 0

    while (remainingSubjects.length > 0) {
      semesters++
      let semesterCredits = 0
      const semesterSubjects = []

      // Regular semester
      if (semesters % 3 !== 0) {
        while (semesterCredits < 30 && remainingSubjects.length > 0) {
          const availableSubject = remainingSubjects.find(subject =>
            isSubjectAvailable(subject, completedSubjects) &&
            semesterCredits + subject.credits <= 30
          )

          if (!availableSubject) break

          addSubjectToSemester(availableSubject, semesterSubjects, completedSubjects)
          semesterCredits += availableSubject.credits
          remainingSubjects = remainingSubjects.filter(s => s !== availableSubject)

          if (BASIC_CYCLE.some(bs => bs.name === availableSubject.name)) {
            basicCycleCredits += availableSubject.credits
          }
        }
      }
      // Summer semester
      else {
        while (semesterCredits < 12 && semesterSubjects.length < 3 && remainingSubjects.length > 0) {
          const availableSubject = remainingSubjects.find(subject =>
            isSubjectAvailable(subject, completedSubjects) &&
            semesterCredits + subject.credits <= 12
          )

          if (!availableSubject) break

          addSubjectToSemester(availableSubject, semesterSubjects, completedSubjects)
          semesterCredits += availableSubject.credits
          remainingSubjects = remainingSubjects.filter(s => s !== availableSubject)

          if (BASIC_CYCLE.some(bs => bs.name === availableSubject.name)) {
            basicCycleCredits += availableSubject.credits
          }
        }
      }

      // Check if we can move to career subjects
      if (basicCycleCredits >= 10 && remainingSubjects.every(s => !BASIC_CYCLE.some(bs => bs.name === s.name))) {
        remainingSubjects = remainingSubjects.filter(s => !BASIC_CYCLE.some(bs => bs.name === s.name))
      }
    }

    const years = (semesters / 3).toFixed(1)
    return { ...career, optimizedSemesters: semesters, optimizedYears: parseFloat(years) }
  })
}

function isSubjectAvailable (subject, completedSubjects) {
  if (!subject || !subject.prerequisites) return true
  if (subject.prerequisites === '-') return true
  return subject.prerequisites.split(',').every(prereq => completedSubjects.has(prereq.trim()))
}

function addSubjectToSemester (subject, semesterSubjects, completedSubjects) {
  semesterSubjects.push(subject)
  if (subject.code) {
    completedSubjects.add(subject.code)
  }
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
