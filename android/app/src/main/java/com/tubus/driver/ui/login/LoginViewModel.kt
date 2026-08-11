package com.tubus.driver.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tubus.driver.data.repo.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUiState(
    val companyCode: String = "",
    val username: String = "",
    val password: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
    val loggedIn: Boolean = false,
)

@HiltViewModel
class LoginViewModel @Inject constructor(private val authRepository: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(LoginUiState(loggedIn = authRepository.isLoggedIn))
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onCompanyCodeChange(value: String) = _state.update { it.copy(companyCode = value) }
    fun onUsernameChange(value: String) = _state.update { it.copy(username = value) }
    fun onPasswordChange(value: String) = _state.update { it.copy(password = value) }

    fun submit() {
        val current = _state.value
        viewModelScope.launch {
            _state.update { it.copy(submitting = true, error = null) }
            try {
                authRepository.login(current.companyCode, current.username, current.password)
                _state.update { it.copy(submitting = false, loggedIn = true) }
            } catch (e: Exception) {
                _state.update { it.copy(submitting = false, error = "No se pudo iniciar sesión.") }
            }
        }
    }
}
