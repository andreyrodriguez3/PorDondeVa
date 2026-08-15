package com.tubus.driver.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.tubus.driver.data.secure.TokenStore
import com.tubus.driver.system.PermissionCoordinator
import com.tubus.driver.ui.home.HomeScreen
import com.tubus.driver.ui.login.LoginScreen
import com.tubus.driver.ui.theme.TuBusTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var tokenStore: TokenStore

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        permissionLauncher.launch(PermissionCoordinator.requiredPermissions())

        setContent {
            TuBusTheme {
                Surface(modifier = Modifier) {
                    var loggedIn by remember { mutableStateOf(tokenStore.isLoggedIn()) }
                    if (loggedIn) {
                        HomeScreen(onLoggedOut = { loggedIn = false })
                    } else {
                        LoginScreen(onLoggedIn = { loggedIn = true })
                    }
                }
            }
        }
    }
}
