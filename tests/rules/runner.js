import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Ensure Java is in PATH (especially on Windows where IDE-bundled JREs might exist)
function ensureJava() {
  const check = spawnSync('java', ['-version'], { stdio: 'ignore', shell: true })
  if (check.status === 0) {
    return
  }

  // Look for Java in common Windows locations if not on PATH
  const candidates = [
    process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin') : null,
    'C:\\Program Files\\Android\\Android Studio\\jbr\\bin',
    'C:\\Program Files\\JetBrains\\PyCharm 2026.2.1\\jbr\\bin',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Java',
  ].filter(Boolean)

  for (const candidate of candidates) {
    const javaExe = path.join(candidate, 'java.exe')
    if (fs.existsSync(javaExe)) {
      process.env.PATH = `${candidate};${process.env.PATH}`
      process.env.JAVA_HOME = path.dirname(candidate)
      return
    }
  }
}

ensureJava()

const isWindows = process.platform === 'win32'
const firebaseCmd = isWindows ? 'firebase.cmd' : 'firebase'

const testCmd = '"node --test tests/rules/firestore.rules.test.js"'

const result = spawnSync(firebaseCmd, ['emulators:exec', '--only', 'firestore', testCmd], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

process.exit(result.status ?? 1)
