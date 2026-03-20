import numpy as np
from scipy.special import iv, kv
from .armour import armour_reduction_factor_n

# Constants
mu0 = 4 * np.pi * 1e-7

def a_n(f, I, a, n, r_AC, Omega, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma):
    """
    Calculate coefficient a_n.
    Port of a_n.m
    """
    omega = 2 * np.pi * f
    
    armour_reduction_n = armour_reduction_factor_n(N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, mu0, n, Omega)
    
    dA_part = armour_reduction_n * 1j * omega * ((mu0 * I) / (2 * np.pi)) * a * (
        iv(n - 1, n * a * Omega) * kv(n - 1, n * r_AC * Omega) - 
        iv(n + 1, n * a * Omega) * kv(n + 1, n * r_AC * Omega)
    )
    
    dV_part = -n * 0.5 * (kv(n - 1, n * r_AC * Omega) + kv(n + 1, n * r_AC * Omega))
    
    a_n_val = dA_part / dV_part
    return a_n_val

def B_three_helices(x, y, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc):
    """
    Calculate Magnetic Field (B) for three helices.
    Port of B_three_helices.m
    """
    r = np.sqrt(x**2 + y**2)
    phi = np.mod(np.arctan2(y, x) + 2 * np.pi, 2 * np.pi)

    Br = _Br_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc)
    Bphi = _Bphi_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc)
    Bz = _Bz_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc)

    B_norm = np.sqrt(np.abs(Br)**2 + np.abs(Bphi)**2 + np.abs(Bz)**2)
    return Br, Bphi, Bz, B_norm

def _Br_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc):
    """Port of Br_three_helices.m"""
    infinite_sum_term = 0
    
    r_min = np.minimum(r, a)
    r_max = np.maximum(r, a)

    for n in range(1, N_calc + 1):
        besseli_term = 0.5 * (iv(n - 1, n * r_min * Omega) + iv(n + 1, n * r_min * Omega))
        besselk_term = -0.5 * (kv(n - 1, n * r_max * Omega) + kv(n + 1, n * r_max * Omega))
        
        term1 = I1 * n * besseli_term * besselk_term * np.sin(n * (phi01 - phi + Omega * z))
        term2 = I2 * n * besseli_term * besselk_term * np.sin(n * (phi02 - phi + Omega * z))
        term3 = I3 * n * besseli_term * besselk_term * np.sin(n * (phi03 - phi + Omega * z))
        
        infinite_sum_term += term1 + term2 + term3

    Br = -(mu0 * a * Omega**2 / np.pi) * infinite_sum_term
    return Br

def _Bphi_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc):
    """Port of Bphi_three_helices.m"""
    first_term = I1 / 2 + I2 / 2 + I3 / 2
    infinite_sum_term = 0
    
    r_min = np.minimum(r, a)
    r_max = np.maximum(r, a)
    
    for n in range(1, N_calc + 1):
        besseli_term = 0.5 * (iv(n - 1, n * r_min * Omega) + iv(n + 1, n * r_min * Omega))
        besselk_term = kv(n, n * r_max * Omega)
        
        term1 = I1 * a * Omega * n * besseli_term * besselk_term * np.cos(n * (phi01 - phi + Omega * z))
        term2 = I2 * a * Omega * n * besseli_term * besselk_term * np.cos(n * (phi02 - phi + Omega * z))
        term3 = I3 * a * Omega * n * besseli_term * besselk_term * np.cos(n * (phi03 - phi + Omega * z))
        
        infinite_sum_term += term1 + term2 + term3

    # Handle r=0 case to avoid division by zero (though typically r > r_AC)
    # With iv(r_min), the infinite_sum_term should be proportional to r for n=1, so sum/r is finite.
    # But we need to be careful with 1/r.
    with np.errstate(divide='ignore', invalid='ignore'):
        Bphi = (mu0 / (np.pi * r)) * (first_term + infinite_sum_term)
        Bphi = np.nan_to_num(Bphi, posinf=0, neginf=0) # Replace infinity at r=0 with 0 (or appropriate limit)
        
    return Bphi

def _Bz_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc):
    """Port of Bz_three_helices.m"""
    infinite_sum_term = 0
    
    r_min = np.minimum(r, a)
    r_max = np.maximum(r, a)
    
    for n in range(1, N_calc + 1):
        besseli_term = 0.5 * (iv(n - 1, n * r_min * Omega) + iv(n + 1, n * r_min * Omega))
        besselk_term = kv(n, n * r_max * Omega)
        
        term1 = I1 * n * besseli_term * besselk_term * np.cos(n * (phi01 - phi + Omega * z))
        term2 = I2 * n * besseli_term * besselk_term * np.cos(n * (phi02 - phi + Omega * z))
        term3 = I3 * n * besseli_term * besselk_term * np.cos(n * (phi03 - phi + Omega * z))
        
        infinite_sum_term += term1 + term2 + term3

    Bz = -(mu0 / np.pi) * a * Omega**2 * infinite_sum_term
    return Bz

def A_three_helices(x, y, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc):
    """
    Calculate Vector Potential (A) for three helices.
    Port of A_three_helices.m
    """
    r = np.sqrt(x**2 + y**2)
    phi = np.mod(np.arctan2(y, x) + 2 * np.pi, 2 * np.pi)

    Ar = _Ar_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc)
    Aphi = _Aphi_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc)
    Az = _Az_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc)

    A_norm = np.sqrt(np.abs(Ar)**2 + np.abs(Aphi)**2 + np.abs(Az)**2)
    return Ar, Aphi, Az, A_norm

def _Ar_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc):
    """Port of Ar_three_helices.m"""
    r_min = np.minimum(r, a)
    r_max = np.maximum(r, a)
    
    first_term = (
        I1 * iv(0, a * Omega) * kv(0, r * Omega) * np.sin(phi01 - phi + Omega * z) +
        I2 * iv(0, a * Omega) * kv(0, r * Omega) * np.sin(phi02 - phi + Omega * z) +
        I3 * iv(0, a * Omega) * kv(0, r * Omega) * np.sin(phi03 - phi + Omega * z)
    )
    # Wait, I need to replace a and r in the arguments too!
    # Corrected first_term:
    first_term = (
        I1 * iv(0, r_min * Omega) * kv(0, r_max * Omega) * np.sin(phi01 - phi + Omega * z) +
        I2 * iv(0, r_min * Omega) * kv(0, r_max * Omega) * np.sin(phi02 - phi + Omega * z) +
        I3 * iv(0, r_min * Omega) * kv(0, r_max * Omega) * np.sin(phi03 - phi + Omega * z)
    )

    second_term = (
        I1 * iv(1, 2 * r_min * Omega) * kv(1, 2 * r_max * Omega) * np.sin(2 * (phi01 - phi + Omega * z)) +
        I2 * iv(1, 2 * r_min * Omega) * kv(1, 2 * r_max * Omega) * np.sin(2 * (phi02 - phi + Omega * z)) +
        I3 * iv(1, 2 * r_min * Omega) * kv(1, 2 * r_max * Omega) * np.sin(2 * (phi03 - phi + Omega * z))
    )

    infinite_sum_term = 0
    for n in range(2, N_calc + 1):
        term1 = (
            I1 * iv(n, (n + 1) * r_min * Omega) * kv(n, (n + 1) * r_max * Omega) * np.sin((n + 1) * (phi01 - phi + Omega * z)) -
            I1 * iv(n, (n - 1) * r_min * Omega) * kv(n, (n - 1) * r_max * Omega) * np.sin((n - 1) * (phi01 - phi + Omega * z))
        )
        term2 = (
            I2 * iv(n, (n + 1) * r_min * Omega) * kv(n, (n + 1) * r_max * Omega) * np.sin((n + 1) * (phi02 - phi + Omega * z)) -
            I2 * iv(n, (n - 1) * r_min * Omega) * kv(n, (n - 1) * r_max * Omega) * np.sin((n - 1) * (phi02 - phi + Omega * z))
        )
        term3 = (
            I3 * iv(n, (n + 1) * r_min * Omega) * kv(n, (n + 1) * r_max * Omega) * np.sin((n + 1) * (phi03 - phi + Omega * z)) -
            I3 * iv(n, (n - 1) * r_min * Omega) * kv(n, (n - 1) * r_max * Omega) * np.sin((n - 1) * (phi03 - phi + Omega * z))
        )
        infinite_sum_term += term1 + term2 + term3

    Ar = -(mu0 * a * Omega / (2 * np.pi)) * (first_term + second_term + infinite_sum_term)
    return Ar

def _Aphi_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc):
    """Port of Aphi_three_helices.m"""
    first_term = I1 * a / (2 * r) + I2 * a / (2 * r) + I3 * a / (2 * r)
    
    r_min = np.minimum(r, a)
    r_max = np.maximum(r, a)

    second_term = (
        I1 * iv(0, r_min * Omega) * kv(0, r_max * Omega) * np.cos(phi01 - phi + Omega * z) +
        I2 * iv(0, r_min * Omega) * kv(0, r_max * Omega) * np.cos(phi02 - phi + Omega * z) +
        I3 * iv(0, r_min * Omega) * kv(0, r_max * Omega) * np.cos(phi03 - phi + Omega * z)
    )

    third_term = (
        I1 * iv(1, 2 * r_min * Omega) * kv(1, 2 * r_max * Omega) * np.cos(2 * (phi01 - phi + Omega * z)) +
        I2 * iv(1, 2 * r_min * Omega) * kv(1, 2 * r_max * Omega) * np.cos(2 * (phi02 - phi + Omega * z)) +
        I3 * iv(1, 2 * r_min * Omega) * kv(1, 2 * r_max * Omega) * np.cos(2 * (phi03 - phi + Omega * z))
    )

    infinite_sum_term = 0
    for n in range(2, N_calc + 1):
        term1 = (
            I1 * iv(n, (n + 1) * r_min * Omega) * kv(n, (n + 1) * r_max * Omega) * np.cos((n + 1) * (phi01 - phi + Omega * z)) +
            I1 * iv(n, (n - 1) * r_min * Omega) * kv(n, (n - 1) * r_max * Omega) * np.cos((n - 1) * (phi01 - phi + Omega * z))
        )
        term2 = (
            I2 * iv(n, (n + 1) * r_min * Omega) * kv(n, (n + 1) * r_max * Omega) * np.cos((n + 1) * (phi02 - phi + Omega * z)) +
            I2 * iv(n, (n - 1) * r_min * Omega) * kv(n, (n - 1) * r_max * Omega) * np.cos((n - 1) * (phi02 - phi + Omega * z))
        )
        term3 = (
            I3 * iv(n, (n + 1) * r_min * Omega) * kv(n, (n + 1) * r_max * Omega) * np.cos((n + 1) * (phi03 - phi + Omega * z)) +
            I3 * iv(n, (n - 1) * r_min * Omega) * kv(n, (n - 1) * r_max * Omega) * np.cos((n - 1) * (phi03 - phi + Omega * z))
        )
        infinite_sum_term += term1 + term2 + term3

    # Handle 1/r singularity in first_term if needed, but usually sum(I)=0
    with np.errstate(divide='ignore', invalid='ignore'):
        Aphi = (mu0 * a * Omega / (2 * np.pi)) * (first_term + second_term + third_term + infinite_sum_term)
        Aphi = np.nan_to_num(Aphi, posinf=0, neginf=0)

    return Aphi

def _Az_three_helices(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc):
    """Port of Az_three_helices.m"""
    bessel_function_term = 0 # As per MATLAB code
    
    r_min = np.minimum(r, a)
    r_max = np.maximum(r, a)
    
    infinite_sum_term = 0
    for n in range(1, N_calc + 1):
        term1 = 2 * I1 * iv(n, n * r_min * Omega) * kv(n, n * r_max * Omega) * np.cos(n * (phi01 - phi + Omega * z))
        term2 = 2 * I2 * iv(n, n * r_min * Omega) * kv(n, n * r_max * Omega) * np.cos(n * (phi02 - phi + Omega * z))
        term3 = 2 * I3 * iv(n, n * r_min * Omega) * kv(n, n * r_max * Omega) * np.cos(n * (phi03 - phi + Omega * z))
        
        infinite_sum_term += term1 + term2 + term3

    Az = (mu0 / (2 * np.pi)) * (bessel_function_term + infinite_sum_term)
    return Az

def B_three_helices_armour(x, y, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma):
    """
    Calculate Magnetic Field (B) for three helices with armour.
    Port of B_three_helices_armour.m
    """
    r = np.sqrt(x**2 + y**2)
    phi = np.mod(np.arctan2(y, x) + 2 * np.pi, 2 * np.pi)

    Br = _Br_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma)
    Bphi = _Bphi_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma)
    Bz = _Bz_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma)

    B_norm = np.sqrt(np.abs(Br)**2 + np.abs(Bphi)**2 + np.abs(Bz)**2)
    return Br, Bphi, Bz, B_norm

def _Br_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma):
    """Port of Br_three_helices_armour.m"""
    infinite_sum_term = 0
    for n in range(1, N_calc + 1):
        armour_reduction_n = armour_reduction_factor_n(N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, mu0, n, Omega)
        
        besseli_term = 0.5 * (iv(n - 1, n * a * Omega) + iv(n + 1, n * a * Omega))
        besselk_term = -0.5 * (kv(n - 1, n * r * Omega) + kv(n + 1, n * r * Omega))
        
        term1 = armour_reduction_n * (I1 * n * besseli_term * besselk_term * np.sin(n * (phi01 - phi + Omega * z)))
        term2 = armour_reduction_n * (I2 * n * besseli_term * besselk_term * np.sin(n * (phi02 - phi + Omega * z)))
        term3 = armour_reduction_n * (I3 * n * besseli_term * besselk_term * np.sin(n * (phi03 - phi + Omega * z)))
        
        infinite_sum_term += term1 + term2 + term3

    Br = -(mu0 * a * Omega**2 / np.pi) * infinite_sum_term
    return Br

def _Bphi_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma):
    """Port of Bphi_three_helices_armour.m"""
    first_term = I1 / 2 + I2 / 2 + I3 / 2
    infinite_sum_term = 0
    
    for n in range(1, N_calc + 1):
        armour_reduction_n = armour_reduction_factor_n(N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, mu0, n, Omega)
        
        besseli_term = 0.5 * (iv(n - 1, n * a * Omega) + iv(n + 1, n * a * Omega))
        besselk_term = kv(n, n * r * Omega)
        
        term1 = armour_reduction_n * (I1 * a * Omega * n * besseli_term * besselk_term * np.cos(n * (phi01 - phi + Omega * z)))
        term2 = armour_reduction_n * (I2 * a * Omega * n * besseli_term * besselk_term * np.cos(n * (phi02 - phi + Omega * z)))
        term3 = armour_reduction_n * (I3 * a * Omega * n * besseli_term * besselk_term * np.cos(n * (phi03 - phi + Omega * z)))
        
        infinite_sum_term += term1 + term2 + term3

    Bphi = (mu0 / (np.pi * r)) * (first_term + infinite_sum_term)
    return Bphi

def _Bz_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma):
    """Port of Bz_three_helices_armour.m"""
    infinite_sum_term = 0
    for n in range(1, N_calc + 1):
        armour_reduction_n = armour_reduction_factor_n(N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, mu0, n, Omega)
        
        besseli_term = 0.5 * (iv(n - 1, n * a * Omega) + iv(n + 1, n * a * Omega))
        besselk_term = kv(n, n * r * Omega)
        
        term1 = armour_reduction_n * (I1 * n * besseli_term * besselk_term * np.cos(n * (phi01 - phi + Omega * z)))
        term2 = armour_reduction_n * (I2 * n * besseli_term * besselk_term * np.cos(n * (phi02 - phi + Omega * z)))
        term3 = armour_reduction_n * (I3 * n * besseli_term * besselk_term * np.cos(n * (phi03 - phi + Omega * z)))
        
        infinite_sum_term += term1 + term2 + term3

    Bz = -(mu0 / np.pi) * a * Omega**2 * infinite_sum_term
    return Bz

def A_three_helices_armour(x, y, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma):
    """
    Calculate Vector Potential (A) for three helices with armour.
    Port of A_three_helices_armour.m
    """
    r = np.sqrt(x**2 + y**2)
    phi = np.mod(np.arctan2(y, x) + 2 * np.pi, 2 * np.pi)

    Ar = _Ar_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma)
    Aphi = _Aphi_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma)
    Az = _Az_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma)

    A_norm = np.sqrt(np.abs(Ar)**2 + np.abs(Aphi)**2 + np.abs(Az)**2)
    return Ar, Aphi, Az, A_norm

def _Ar_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma):
    """Port of Ar_three_helices_armour.m"""
    infinite_sum_term = 0
    for n in range(1, N_calc + 1):
        armour_reduction_n = armour_reduction_factor_n(N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, mu0, n, Omega)
        
        term1 = armour_reduction_n * (I1 * iv(n - 1, n * a * Omega) * kv(n - 1, n * r * Omega) * np.sin(n * (phi01 - phi + Omega * z)))
        term2 = -armour_reduction_n * (I1 * iv(n + 1, n * a * Omega) * kv(n + 1, n * r * Omega) * np.sin(n * (phi01 - phi + Omega * z)))
        
        term3 = armour_reduction_n * (I2 * iv(n - 1, n * a * Omega) * kv(n - 1, n * r * Omega) * np.sin(n * (phi02 - phi + Omega * z)))
        term4 = -armour_reduction_n * (I2 * iv(n + 1, n * a * Omega) * kv(n + 1, n * r * Omega) * np.sin(n * (phi02 - phi + Omega * z)))
        
        term5 = armour_reduction_n * (I3 * iv(n - 1, n * a * Omega) * kv(n - 1, n * r * Omega) * np.sin(n * (phi03 - phi + Omega * z)))
        term6 = -armour_reduction_n * (I3 * iv(n + 1, n * a * Omega) * kv(n + 1, n * r * Omega) * np.sin(n * (phi03 - phi + Omega * z)))
        
        infinite_sum_term += term1 + term2 + term3 + term4 + term5 + term6

    Ar = -(mu0 * a * Omega / (2 * np.pi)) * infinite_sum_term
    return Ar

def _Aphi_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma):
    """Port of Aphi_three_helices_armour.m"""
    first_term = I1 * a / (2 * r) + I2 * a / (2 * r) + I3 * a / (2 * r)
    
    infinite_sum_term = 0
    for n in range(1, N_calc + 1):
        armour_reduction_n = armour_reduction_factor_n(N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, mu0, n, Omega)
        
        term1 = armour_reduction_n * (I1 * iv(n - 1, n * a * Omega) * kv(n - 1, n * r * Omega) * np.cos(n * (phi01 - phi + Omega * z)))
        term2 = armour_reduction_n * (I1 * iv(n + 1, n * a * Omega) * kv(n + 1, n * r * Omega) * np.cos(n * (phi01 - phi + Omega * z)))
        
        term3 = armour_reduction_n * (I2 * iv(n - 1, n * a * Omega) * kv(n - 1, n * r * Omega) * np.cos(n * (phi02 - phi + Omega * z)))
        term4 = armour_reduction_n * (I2 * iv(n + 1, n * a * Omega) * kv(n + 1, n * r * Omega) * np.cos(n * (phi02 - phi + Omega * z)))
        
        term5 = armour_reduction_n * (I3 * iv(n - 1, n * a * Omega) * kv(n - 1, n * r * Omega) * np.cos(n * (phi03 - phi + Omega * z)))
        term6 = armour_reduction_n * (I3 * iv(n + 1, n * a * Omega) * kv(n + 1, n * r * Omega) * np.cos(n * (phi03 - phi + Omega * z)))
        
        infinite_sum_term += term1 + term2 + term3 + term4 + term5 + term6

    Aphi = (mu0 * a * Omega / (2 * np.pi)) * (first_term + infinite_sum_term)
    return Aphi

def _Az_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma):
    """Port of Az_three_helices_armour.m"""
    bessel_function_term = 0
    
    infinite_sum_term = 0
    for n in range(1, N_calc + 1):
        armour_reduction_n = armour_reduction_factor_n(N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, mu0, n, Omega)
        
        term1 = armour_reduction_n * (2 * I1 * iv(n, n * a * Omega) * kv(n, n * r * Omega) * np.cos(n * (phi01 - phi + Omega * z)))
        term2 = armour_reduction_n * (2 * I2 * iv(n, n * a * Omega) * kv(n, n * r * Omega) * np.cos(n * (phi02 - phi + Omega * z)))
        term3 = armour_reduction_n * (2 * I3 * iv(n, n * a * Omega) * kv(n, n * r * Omega) * np.cos(n * (phi03 - phi + Omega * z)))
        
        infinite_sum_term += term1 + term2 + term3

    Az = (mu0 / (2 * np.pi)) * (bessel_function_term + infinite_sum_term)
    return Az

def Vr_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, f, r_AC, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma):
    """Port of Vr_three_helices_armour.m"""
    infinite_sum_term = 0
    for n in range(1, N_calc + 1):
        a_n_1 = a_n(f, I1, a, n, r_AC, Omega, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
        a_n_2 = a_n(f, I2, a, n, r_AC, Omega, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
        a_n_3 = a_n(f, I3, a, n, r_AC, Omega, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
        
        bessel_term = 0.5 * (kv(n - 1, n * r * Omega) + kv(n + 1, n * r * Omega))
        
        term1 = a_n_1 * n * Omega * bessel_term * np.sin(n * (phi01 - phi + Omega * z))
        term2 = a_n_2 * n * Omega * bessel_term * np.sin(n * (phi02 - phi + Omega * z))
        term3 = a_n_3 * n * Omega * bessel_term * np.sin(n * (phi03 - phi + Omega * z))
        
        infinite_sum_term += term1 + term2 + term3

    Vr = infinite_sum_term
    return Vr

def Vphi_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, f, r_AC, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma):
    """Port of Vphi_three_helices_armour.m"""
    infinite_sum_term = 0
    for n in range(1, N_calc + 1):
        a_n_1 = a_n(f, I1, a, n, r_AC, Omega, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
        a_n_2 = a_n(f, I2, a, n, r_AC, Omega, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
        a_n_3 = a_n(f, I3, a, n, r_AC, Omega, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
        
        bessel_term = kv(n, n * r * Omega)
        
        term1 = (1 / r) * a_n_1 * n * bessel_term * np.cos(n * (phi01 - phi + Omega * z))
        term2 = (1 / r) * a_n_2 * n * bessel_term * np.cos(n * (phi02 - phi + Omega * z))
        term3 = (1 / r) * a_n_3 * n * bessel_term * np.cos(n * (phi03 - phi + Omega * z))
        
        infinite_sum_term += term1 + term2 + term3

    Vphi = infinite_sum_term
    return Vphi

def Vz_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, f, r_AC, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma):
    """Port of Vz_three_helices_armour.m"""
    infinite_sum_term = 0
    for n in range(1, N_calc + 1):
        a_n_1 = a_n(f, I1, a, n, r_AC, Omega, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
        a_n_2 = a_n(f, I2, a, n, r_AC, Omega, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
        a_n_3 = a_n(f, I3, a, n, r_AC, Omega, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
        
        bessel_term = kv(n, n * r * Omega)
        
        term1 = -a_n_1 * n * Omega * bessel_term * np.cos(n * (phi01 - phi + Omega * z))
        term2 = -a_n_2 * n * Omega * bessel_term * np.cos(n * (phi02 - phi + Omega * z))
        term3 = -a_n_3 * n * Omega * bessel_term * np.cos(n * (phi03 - phi + Omega * z))
        
        infinite_sum_term += term1 + term2 + term3

    Vz = infinite_sum_term
    return Vz

def E_three_helices_armour(x, y, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, r_AC):
    """
    Calculate Electric Field (E) for three helices with armour.
    Port of E_three_helices_armour.m
    """
    r = np.sqrt(x**2 + y**2)
    phi = np.mod(np.arctan2(y, x) + 2 * np.pi, 2 * np.pi)
    
    Vr = Vr_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, f, r_AC, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
    Ar = _Ar_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma)
    Er = Vr - 1j * 2 * np.pi * f * Ar
    
    Vphi = Vphi_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, f, r_AC, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
    Aphi = _Aphi_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma)
    Ephi = Vphi - 1j * 2 * np.pi * f * Aphi
    
    Vz = Vz_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, f, r_AC, N, d_f, d_A, p_A, p_c, t, lay_factor, mu_r, sigma)
    Az = _Az_three_helices_armour(r, phi, z, a, Omega, phi01, phi02, phi03, I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma)
    Ez = Vz - 1j * 2 * np.pi * f * Az
    
    E_norm = np.sqrt(np.abs(Er)**2 + np.abs(Ephi)**2 + np.abs(Ez)**2)
    return Er, Ephi, Ez, E_norm
