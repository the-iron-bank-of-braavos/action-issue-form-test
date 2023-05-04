/**
 * Script que se ejecuta cuando se crea una issue en el repositorio
 * analiza el contenido de la issue y crea un repositorio en la organización
 * con el nombre y descripción indicados en la issue.
 * 
 * Asigna el equipo de administradores indicado en la issue como administrador
 * 
 * Si el repositorio se crea correctamente, se cierra la issue
 * 
 * Si se produce algún error, se añade un comentario en la issue indicando el error
 * 
 */

module.exports = async ({ github, context, core }) => {

  const noResponse = "_No response_"                      //Valor que se utiliza para indicar que no se ha informado un campo opcional
  const prefix = "gln-"                                   //Prefijo que debe tener el nombre del repositorio
  const repoNamePos = 2                                   //Posición del nombre del repositorio en el cuerpo de la issue
  const repoDescriptionPos = 6                            //Posición de la descripción del repositorio en el cuerpo de la issue
  const adminTeamPos = 10                                 //Posición del equipo de administradores en el cuerpo de la issue
  const regex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}/i //Expresión regular para validar el nombre del repositorio

  let lineas = ""
  let repoName = ""
  let repoDescription = ""
  let adminTeam = ""

  // inicializamos una lista con los errors encontrados
  let errors = []

  //verificamos que tenemos contenido en las lineas necesarias
  if (context.payload.issue.body == null) {

    core.setFailed("Issue body is empty.")
    errors.push("The issue body does not have the required information, modify the issue")

  }else{
    // hay contenido en el cuerpo de la issue, la procesamos

    lineas = context.payload.issue.body.split("\n")
    repoName = lineas[repoNamePos].trim()
    repoDescription = lineas[repoDescriptionPos].trim()
    adminTeam = lineas[adminTeamPos].trim()

    //Comprobamos que el equipo de administración viene informado y existe
    if (adminTeam == noResponse || adminTeam == "") {
      errors.push("Admin team is mandatory, update the issue")
    } else {
      //Comprobamos que el team de administradores existe en la organización
      try {
        const { data: team } = await github.rest.teams.getByName({
          org: context.repo.owner,
          team_slug: adminTeam
        })
        core.info("Admin team " + adminTeam + " exists in the organization, id: " + team.id)
      } catch (error) {
        errors.push("Admin team " + adminTeam + " does not exist in the organization, update the issue. Error: " + error)
        console.log(error)
      }
    }

    //Comprobamos que el nombre del repositorio cumple con los requisitos y que no existe en la organización
    if (!regex.test(repoName) || !repoName.startsWith(prefix)) {
      errors.push("Repository name " + repoName + " does not meet the requirements, update the issue")
    }else{
      //Comprobamos que el repositorio no existe en la organización
      try {
        await github.rest.repos.get({
          owner: context.repo.owner,
          repo: repoName
        })
        errors.push("Repository " + repoName + " already exists in the organization, update the issue")
      } catch (error) {
        core.info("Repository " + repoName + " does not exist in the organization")
      } 
    }
  }

  //Procesamos la lista de errores de las validaciones previas
  if (errors.length > 0) {
    let body = ""
    for (error of errors) {
      body += ":x: " + error + "\n"
    }
    //Crear un comentario en la issue avisando del error
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number,
      body: body
    })
    core.setFailed("Error validating issue information to create " + repoName + " in organization " + context.repo.owner + ". Errors: " + errors)
    return
  }

  //Establecemos el valor a vacío en lugar de _No reponse_ en los campos opcionales
  if (repoDescription == noResponse) {
    repoDescription = ""
  }

  //Validaciones previas correctas, se puede crear el repositorio
  core.info("Issue number: " + context.payload.issue.number)
  core.info("Repository name: " + repoName)
  core.info("Repository description: " + repoDescription)
  core.info("Admin team: " + adminTeam)
  core.info("Creating repository " + repoName + " in organization " + context.repo.owner)

  try {
    //crear el repositorio en la organización
    const { data: repo } = await github.rest.repos.createInOrg({
      org: context.repo.owner,
      name: repoName,
      description: repoDescription,
      private: true
    })

    core.info("Repository " + repoName + " created in organization " + context.repo.owner + ". URL: " + repo.html_url)
    core.info("Adding admin team " + adminTeam + " to repository " + repoName + " in organization " + context.repo.owner)

    //Añadir el team de administradores al repositorio
    await github.rest.teams.addOrUpdateRepoPermissionsInOrg({
      org: context.repo.owner,
      team_slug: adminTeam,
      owner: context.repo.owner,
      repo: repoName,
      permission: "admin"
    })

    core.info("Admin team " + adminTeam + " added to repository " + repoName + " in organization " + context.repo.owner)

    //Añadir comentario en la issue indicando que el repositorio se ha creado correctamente
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number,
      body: ":white_check_mark: Repository " + repoName + " created in organization " + context.repo.owner + ". URL: " + repo.html_url
    })

    //Cerrar la issue
    await github.rest.issues.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number,
      state: "closed",
      comment: "Repository " + repoName + " created in organization " + context.repo.owner
    })
  }
  catch (error) {
    core.setFailed("Error creating repository " + repoName + " in organization " + context.repo.owner + ". Error: " + error)
    github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number,
      body: ":x: Error creating repository " + repoName + " in organization " + context.repo.owner + ". Error: " + error
    })
    //Mostrar el error completo en la consola y todas las trazas posibles
    console.log(error)
    return
  }
  
  return repoName
}