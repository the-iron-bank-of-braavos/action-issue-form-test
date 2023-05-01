/**
 * Script que se ejecuta cuando se crea una issue en el repositorio
 * analiza el contenido de la issue y crea un repositorio en la organización
 * con el nombre y descripción indicados en la issue.
 * 
 */

module.exports = async ({github, context, core}) => {

    core.debug(context.payload.issue.body)
    
    const noResponse = "_No response_"
    const prefix = "gln-"
    const repoNamePos = 2
    const repoDescriptionPos = 6
    const adminTemaPos = 10
   
    let lineas = context.payload.issue.body.split("\n")
    let repoName = lineas[repoNamePos].trim()
    let repoDescription = lineas[repoDescriptionPos].trim()
    let adminTeam = lineas[adminTemaPos].trim()
    let adminTeamId

 
    // inicializamos una lista con los errors encontrados
    let errors = []

    //Comprobamos que los campos obligatorios están informados
    if (adminTeam == noResponse || adminTeam == ""){
      errors.push("Admin team is mandatory, update the issue")
    }else{
      //Comprobamos que el team de administradores existe en la organización
      // y recuperamos su id
      console.log("Admin team: " + adminTeam)
      try {
        const { data: team } =  await github.rest.teams.getByName({
          org: context.repo.owner,
          team_slug: adminTeam
        })
        core.info("Admin team " + adminTeam + " exists in the organization, id: " + team.id)
        adminTeamId=team.id
        console.log("Admin team id: " + adminTeamId)
      }catch (error){
        errors.push("Admin team " + adminTeam + " does not exist in the organization, update the issue. Error: " + error)
      }
    }
    
    //Comprobamos que el nombre del repositorio cumple con los requisitos
    const regex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}/i
    if (!regex.test(repoName) || !repoName.startsWith(prefix)) {
      errors.push("Repository name " + repoName + " does not meet the requirements, update the issue")
    }

    //Procesamos la lista de errors de validación previa
    if (errors.length > 0){
      let body = ""
      for(error of errors){
        body += ":x: " + error + "\n"
      }
      //Crear un comentario en la issue avisando del error
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        body: body
      })
      return
    }

    //Establecemos el valor a vacío en lugar de _No repoonse_ en los campos opcionales
    if (repoDescription == noResponse){
      repoDescription = ""
    }
      
    //Validaciones previas correctas, se puede crear el repositorio
    core.info("Issue number: " + context.payload.issue.number)
    core.info("Repository name: " + repoName)
    core.info("Repository description: " + repoDescription)
    core.info("Admin team: " + adminTeam)
    core.info("Admin team id: " + adminTeamId)
    
    core.info("Creating repository " + repoName + " in organization " + context.repo.owner)
    
    try {
      //crear el repositorio en la organización
      await github.rest.repos.createInOrg({
        org: context.repo.owner,
        name: repoName,
        description: repoDescription,
        private: true,
        team_id: adminTeamId
      })

      core.info("Repository " + repoName + " created in organization " + context.repo.owner)
      core.info("Closing issue " + context.payload.issue.number)
 
      //cerrar la issue con el comentario
      github.rest.issues.update({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        state: "closed",
        comment: "Repository " + repoName + " created in organization " + context.repo.owner
      })
    }
    catch (error){
      core.setFailed("Error creating repository " + repoName + " in organization " + context.repo.owner + ". Error: " + error)
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        body: ":x: Error creating repository " + repoName + " in organization " + context.repo.owner + ". Error: " + error
      }) 
      return
    }
    core.info("Repository " + repoName + " created in organization " + context.repo.owner)
  
    //TODO: retornar la url del repositorio creado y cerrar la issue
    return "https://github.com/" + context.repo.owner + "/" + repoName
  }