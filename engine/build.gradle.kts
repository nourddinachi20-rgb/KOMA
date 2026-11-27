plugins {
    kotlin("jvm") version "2.2.10"
    application
}

group = "com.noctis"
version = "1.0.0"

kotlin {
    jvmToolchain(17)
}

application {
    mainClass.set("com.noctis.engine.MainKt")
}

dependencies {
    implementation("org.koitharu:kotatsu-parsers:1.0")
    implementation("io.ktor:ktor-server-core-jvm:3.1.1")
    implementation("io.ktor:ktor-server-cio-jvm:3.1.1")
    implementation("io.ktor:ktor-server-cors-jvm:3.1.1")
    implementation("io.ktor:ktor-server-status-pages-jvm:3.1.1")
    implementation("com.squareup.okhttp3:okhttp:5.1.0")
    implementation("org.json:json:20240303")
    implementation("org.mozilla:rhino:1.7.15")
    implementation("org.slf4j:slf4j-simple:2.0.16")
}

tasks.register<Jar>("fatJar") {
    group = "build"
    description = "Assembles a runnable fat JAR with all bundled Kotatsu parsers and dependencies."
    archiveBaseName.set("noctis-engine")
    archiveClassifier.set("")
    archiveVersion.set("")
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    manifest {
        attributes["Main-Class"] = "com.noctis.engine.MainKt"
    }
    from(sourceSets.main.get().output)
    dependsOn(configurations.runtimeClasspath)
    from({
        configurations.runtimeClasspath.get()
            .filter { it.name.endsWith("jar") }
            .map { zipTree(it) }
    }) {
        exclude("META-INF/*.SF", "META-INF/*.DSA", "META-INF/*.RSA", "META-INF/LICENSE*", "META-INF/NOTICE*")
    }
}
