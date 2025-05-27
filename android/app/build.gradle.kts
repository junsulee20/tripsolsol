plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
}

dependencies {
    // Import the Firebase BoM
    implementation(platform("com.google.firebase:firebase-bom:33.14.0"))

    // Firebase Analytics
    implementation("com.google.firebase:firebase-analytics")
} 