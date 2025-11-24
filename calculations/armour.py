import numpy as np
from scipy.special import iv, kv

def sheath_reduction_factor(R_s, d_s, s, f):
    """
    Calculate the reduction factor due to the sheath reactances.
    Port of sheath_reduction_factor.m
    """
    # Calculate X_s - the reactance of the sheaths
    # MATLAB: X_s = 2*2*pi*f*10^(-7)*log(2*s/d_s);
    X_s = 2 * 2 * np.pi * f * 1e-7 * np.log(2 * s / d_s)
    
    # MATLAB: sheath_reduction = sqrt(1-1/(1+(R_s/X_s)^2));
    sheath_reduction = np.sqrt(1 - 1 / (1 + (R_s / X_s)**2))
    
    return sheath_reduction

def armour_reduction_factor(N, s, d_f, d_A, r_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, mu0):
    """
    Calculate the reduction factor for the armour (Method 2 based on Kevin's work).
    Port of armour_reduction_factor.m
    """
    # Parameters of the armour
    mu_t = 10 # transverse permeability of the armour
    
    # Calculate the longitudinal permeability
    # MATLAB: k = sqrt(1i*2*pi*f*mu_r*mu0*sigma);
    k = np.sqrt(1j * 2 * np.pi * f * mu_r * mu0 * sigma)
    
    # MATLAB: mu_l = (4*mu_r*besseli(1,k*d_f/2))/(k*d_f*besseli(0,k*d_f/2));
    # Note: scipy.special.iv is modified bessel function of first kind (besseli)
    mu_l = (4 * mu_r * iv(1, k * d_f / 2)) / (k * d_f * iv(0, k * d_f / 2))
    
    # Calculate Beta - the angle between the H-field and the transverse direction
    # MATLAB: beta_a = atan(pi*d_A/p_A)-lay_factor*atan(pi*d_A/p_c);
    beta_a = np.arctan(np.pi * d_A / p_A) - lay_factor * np.arctan(np.pi * d_A / p_c)
    
    # Calculate the permeability
    # MATLAB: mu = mu_t*cos(beta_a)^2 + mu_l*sin(beta_a)^2;
    mu = mu_t * np.cos(beta_a)**2 + mu_l * np.sin(beta_a)**2
    
    # MATLAB: mu_A = mu*(1+(pi*d_A/p_c)^2);
    mu_A = mu * (1 + (np.pi * d_A / p_c)**2)
    
    # Calculate the reflection factors
    # MATLAB: RF_2 = (t*mu_A)/(d_A+t*mu_A);
    RF_2 = (t * mu_A) / (d_A + t * mu_A)
    # MATLAB: RF_4 = (2*t*mu_A)/(d_A + 2*t*mu_A);
    RF_4 = (2 * t * mu_A) / (d_A + 2 * t * mu_A)
    
    # Calculate the screening factors
    # MATLAB: SF_2 = 1/(1+mu_A*t/r_A);
    SF_2 = 1 / (1 + mu_A * t / r_A)
    # MATLAB: SF_4 = 1/(1+2*mu_A*t/r_A);
    SF_4 = 1 / (1 + 2 * mu_A * t / r_A)
    
    # Calculate the reduction factor for the armour
    # MATLAB: armour_reduction_2 = (1+RF_2)*SF_2;
    armour_reduction_2 = (1 + RF_2) * SF_2
    # MATLAB: armour_reduction_4 = (1+RF_4)*SF_4;
    armour_reduction_4 = (1 + RF_4) * SF_4
    
    return armour_reduction_2, armour_reduction_4, RF_2, RF_4

def armour_reduction_factor_n(N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, mu0, n, Omega):
    """
    Calculate the armour reduction factor for harmonic n.
    Port of armour_reduction_factor_n.m
    """
    # Parameters of the armour
    
    # Calculate the transverse permeability
    r_A = d_A / 2
    
    l_A = np.sqrt(1 + (np.pi * d_A / p_A)**2)
    d_a = (np.pi * d_A) / (N * l_A)
    k = np.sqrt(1j * 2 * np.pi * f * mu_r * mu0 * sigma)
    
    # MATLAB: besseli_d = 0.5*((besseli(0,k*d_f/2)+(besseli(2,k*d_f/2))));
    besseli_d = 0.5 * (iv(0, k * d_f / 2) + iv(2, k * d_f / 2))
    
    # MATLAB: bessel_ratio = (besseli_d)./(besseli(1,k*d_f/2));
    bessel_ratio = besseli_d / iv(1, k * d_f / 2)
    
    # MATLAB: denom = ((2*mu_r+k*d_f*bessel_ratio)./(2*mu_r-k*d_f*bessel_ratio)) - (((pi*d_f)^2)./(12*d_a^2));
    denom = ((2 * mu_r + k * d_f * bessel_ratio) / (2 * mu_r - k * d_f * bessel_ratio)) - (((np.pi * d_f)**2) / (12 * d_a**2))
    
    # MATLAB: mu_t = 1 + 2/(denom);
    mu_t = 1 + 2 / denom
    
    # Calculate the longitudinal permeability
    # MATLAB: mu_l = (4*mu_r*besseli(1,k*d_f/2))/(k*d_f*besseli(0,k*d_f/2));
    mu_l = (4 * mu_r * iv(1, k * d_f / 2)) / (k * d_f * iv(0, k * d_f / 2))
    
    # Calculate Beta
    # MATLAB: beta_a = atan(pi*d_A/p_A) + lay_factor*atan(pi*d_A/p_c);
    # Note: In armour_reduction_factor.m it was -, here it is +. Checking MATLAB source...
    # Source for armour_reduction_factor_n.m line 32: beta_a = atan(pi*d_A/p_A) + lay_factor*atan(pi*d_A/p_c);
    # Source for armour_reduction_factor.m line 23: beta_a = atan(pi*d_A/p_A)-lay_factor*atan(pi*d_A/p_c);
    # I will follow the source code exactly for each function.
    beta_a = np.arctan(np.pi * d_A / p_A) + lay_factor * np.arctan(np.pi * d_A / p_c)
    
    # Calculate the permeability
    # MATLAB: mu = mu_t*cos(beta_a)^2 + mu_l*sin(beta_a)^2;
    mu = mu_t * np.cos(beta_a)**2 + mu_l * np.sin(beta_a)**2
    
    # MATLAB: mu_A = mu*(1+(pi*d_A/p_c)^2);
    mu_A = mu * (1 + (np.pi * d_A / p_c)**2)
    
    # Calculate total permeance
    
    # MATLAB: K_derivative_out = -0.5.*n*Omega*(besselk(n-1,n*(r_A+t/2)*Omega)+besselk(n+1,n*(r_A+t/2)*Omega));
    # Note: scipy.special.kv is modified bessel function of second kind (besselk)
    K_derivative_out = -0.5 * n * Omega * (kv(n - 1, n * (r_A + t / 2) * Omega) + kv(n + 1, n * (r_A + t / 2) * Omega))
    
    # MATLAB: K_out = besselk(n,n*(r_A+t/2)*Omega);
    K_out = kv(n, n * (r_A + t / 2) * Omega)
    
    # MATLAB: P_armour = (mu_A*t)/(r_A/n);
    P_armour = (mu_A * t) / (r_A / n)
    
    # MATLAB: P_outside = abs((1*(r_A+t/2)/n)/(K_out/K_derivative_out));
    P_outside = np.abs((1 * (r_A + t / 2) / n) / (K_out / K_derivative_out))
    
    # MATLAB: P_total = (P_armour+P_outside);
    P_total = (P_armour + P_outside)
    
    # Calculate a_n
    
    # MATLAB: K_derivative = -0.5.*(besselk(n-1,n*(r_A-t/2)*Omega)+besselk(n+1,n*(r_A-t/2)*Omega));
    K_derivative = -0.5 * (kv(n - 1, n * (r_A - t / 2) * Omega) + kv(n + 1, n * (r_A - t / 2) * Omega))
    
    # MATLAB: I_derivative = 0.5.*(besseli(n-1,n*(r_A-t/2)*Omega)+besseli(n+1,n*(r_A-t/2)*Omega));
    I_derivative = 0.5 * (iv(n - 1, n * (r_A - t / 2) * Omega) + iv(n + 1, n * (r_A - t / 2) * Omega))
    
    # MATLAB: a_n = ((r_A-t/2)*Omega*K_derivative+P_total*besselk(n,n*(r_A-t/2)*Omega))./((r_A-t/2)*Omega*I_derivative+P_total*besseli(n,n*(r_A-t/2)*Omega));
    a_n_val = ((r_A - t / 2) * Omega * K_derivative + P_total * kv(n, n * (r_A - t / 2) * Omega)) / \
              ((r_A - t / 2) * Omega * I_derivative + P_total * iv(n, n * (r_A - t / 2) * Omega))
    
    # Calculate the potential in the armour
    # MATLAB: psi_in = besselk(n,n*(r_A-t/2)*Omega)-besseli(n,n*(r_A-t/2)*Omega).*a_n;
    psi_in = kv(n, n * (r_A - t / 2) * Omega) - iv(n, n * (r_A - t / 2) * Omega) * a_n_val
    
    # Calculate the reduction factor
    # MATLAB: armour_reduction_n = psi_in./(besselk(n,n*(r_A+t/2)*Omega));
    armour_reduction_n = psi_in / (kv(n, n * (r_A + t / 2) * Omega))
    
    return armour_reduction_n
