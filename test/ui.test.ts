import { expect, test } from "bun:test"

test("renders product states and correction recovery through the bundled Solid surface contract", async () => {
  const build = Bun.spawn([process.execPath, "run", "build"], {
    cwd: import.meta.dir + "/..",
    stdout: "pipe",
    stderr: "pipe",
  })
  const [buildExit, buildStderr] = await Promise.all([build.exited, new Response(build.stderr).text()])
  if (buildExit !== 0) throw new Error(buildStderr)
  expect(buildExit).toBe(0)

  const child = Bun.spawn([process.execPath, "--conditions=browser", "test/ui-browser-runner.ts"], {
    cwd: import.meta.dir + "/..",
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  expect(stderr).toBe("")
  expect(stdout).toContain("20 VibeLingo UI states and tool-card interactions rendered successfully")
  expect(exitCode).toBe(0)
}, 30_000)
