import groovy.transform.Field
@Field def ctx = [:]
@Library('wildflower-jenkins-pipeline') import com.wildflowerhealth.Lib
@Field def lib = new Lib(this)

lib.wrapJob {
    stage ("init") {
        lib.init()
    }
    stage ("compile") {
        lib.docker.nodeContainer([version: '20', command: "npm version --no-git-tag-version ${ctx.version} && npm install && npm run build && npm run lint && npm run check-format"])
    }
    stage ("image") {
        ctx.image = "wildflowerhealth/mock-saml:${ctx.version}"
        sh "docker build -t ${ctx.image} ."
        lib.github.createTag([ repo: ctx.repo, name: "build/${ctx.version}", hash: ctx.commit ])
    }
    stage ('push') {
        if (['main'].contains(ctx.branch) || ctx.branch.startsWith('PR-') || ctx.branch.startsWith('hotfix/')) {
            lib.docker.pushImage()
        }
    }
}
