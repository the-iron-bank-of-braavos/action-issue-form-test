
module.exports = ({github, context, core}) => {

    core.debug(context.payload.issue.body);
    
    const noResponse = "_No response_";
    const prefix = "gln-";
    const repoNamePos = 2;
    const repoDescriptionPos = 6;
    const adminTemaPos: int = 10
   
    let lineas = context.payload.issue.body.split("\n");
    let repoName = lineas[repoNamePos];
    let repoDescription = lineas[repoDescriptionPos]
    let adminTeam = lineas[adminTemaPos]

    if (repoDescription == noResponse){
      //Establecemos el valor a vacío en lugar de _No repoonse_
      repoDescription = "";
    }
    if (adminTeam == noResponse){
      //El team de administradores del repositorio es obligatorio
      core.setFailed("Admin team es mandatory")
      //TODO: aprovechar y crear un comentario en la issue avisando del error
      return
    }

    core.info("Repository name: " + repoName)
    core.info("Repository description: " + repoDescription)
    core.info("Admin team: " + adminTeam)

    const regex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}/i;
    if (regex.test(repoName) && repoName.startsWith(prefix)) {
      core.info('El nombre del repositorio solicitado comienza con el prefijo y tiene un formato válido');
      //TODO: crear el repositorio para retornar la url
    } else {
      core.setFailed(`El nombre del repositorio ${repoName} no cumple con los requisitos`);
    }
    //TODO: retornar la url del repositorio creado y cerrar la issue
    return context.payload.issue 
  }