import fs from 'fs/promises'
import path from 'path'

async function main() {
  const refName = process.env.GITHUB_REF_NAME

  if (!refName) {
    throw new Error('GITHUB_REF_NAME is required to verify the release tag.')
  }

  const packageJson = JSON.parse(
    await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
  )

  const expectedTag = `v${packageJson.version}`

  if (refName !== expectedTag) {
    throw new Error(
      `Release tag mismatch: expected ${expectedTag} from package.json, received ${refName}.`
    )
  }

  console.log(`Release tag ${refName} matches package.json version ${packageJson.version}.`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
