"""
Utility functions for generating matplotlib plots and converting to base64
"""
import io
import base64
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
import numpy as np


def fig_to_base64(fig, dpi=300):
    """Convert matplotlib figure to base64 encoded PNG"""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=dpi, bbox_inches='tight',
                facecolor='#1e1e1e', edgecolor='none')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    return f"data:image/png;base64,{img_base64}"


def create_dark_figure(figsize=(10, 8), dpi=300):
    """Create a matplotlib figure with dark theme"""
    fig = Figure(figsize=figsize, dpi=dpi, facecolor='#1e1e1e')
    return fig


def style_dark_axes(ax):
    """Apply dark theme styling to axes"""
    ax.set_facecolor('#2a2a2a')
    ax.spines['bottom'].set_color('#e0e0e0')
    ax.spines['top'].set_color('#e0e0e0')
    ax.spines['left'].set_color('#e0e0e0')
    ax.spines['right'].set_color('#e0e0e0')
    ax.tick_params(colors='#e0e0e0', which='both')
    ax.xaxis.label.set_color('#e0e0e0')
    ax.yaxis.label.set_color('#e0e0e0')
    ax.title.set_color('#14ffec')
    return ax


def plot_surface_field(x, y, field_data, title, xlabel, ylabel, colorbar_label):
    """Create a surface plot with dark theme"""
    fig = create_dark_figure(figsize=(10, 8))
    ax = fig.add_subplot(111)

    # Create mesh for pcolormesh
    pcm = ax.pcolormesh(x, y, field_data, cmap='jet', shading='auto')

    # Colorbar
    cbar = fig.colorbar(pcm, ax=ax, label=colorbar_label)
    cbar.ax.yaxis.label.set_color('#e0e0e0')
    cbar.ax.tick_params(colors='#e0e0e0')

    # Labels and title
    ax.set_xlabel(xlabel, fontsize=12, color='#e0e0e0')
    ax.set_ylabel(ylabel, fontsize=12, color='#e0e0e0')
    ax.set_title(title, fontsize=14, color='#14ffec', fontweight='bold')

    # Style
    style_dark_axes(ax)
    ax.set_aspect('equal')

    fig.tight_layout()
    return fig_to_base64(fig)


def plot_radial_profile(r, field_data, title, xlabel, ylabel, labels=None):
    """Create a radial profile plot with dark theme"""
    fig = create_dark_figure(figsize=(10, 6))
    ax = fig.add_subplot(111)

    if labels and len(labels) == len(field_data):
        for data, label in zip(field_data, labels):
            ax.plot(r, data, linewidth=2, label=label)
        ax.legend(facecolor='#2a2a2a', edgecolor='#404040', fontsize=10)
        for text in ax.legend().get_texts():
            text.set_color('#e0e0e0')
    else:
        ax.plot(r, field_data, linewidth=2, color='#14ffec')

    ax.set_xlabel(xlabel, fontsize=12)
    ax.set_ylabel(ylabel, fontsize=12)
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.2, color='#e0e0e0')

    style_dark_axes(ax)
    fig.tight_layout()
    return fig_to_base64(fig)


def plot_azimuthal_profile(theta, field_data, title, xlabel, ylabel):
    """Create an azimuthal profile plot with dark theme"""
    fig = create_dark_figure(figsize=(10, 6))
    ax = fig.add_subplot(111)

    ax.plot(np.degrees(theta), field_data, linewidth=2, color='#14ffec')

    ax.set_xlabel(xlabel, fontsize=12)
    ax.set_ylabel(ylabel, fontsize=12)
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.2, color='#e0e0e0')

    style_dark_axes(ax)
    fig.tight_layout()
    return fig_to_base64(fig)


def plot_multiple_subplots(plot_configs):
    """
    Create multiple subplots
    plot_configs: list of dicts with keys: type, data, title, etc.
    """
    n_plots = len(plot_configs)
    fig = create_dark_figure(figsize=(12, 4*n_plots))

    for idx, config in enumerate(plot_configs):
        ax = fig.add_subplot(n_plots, 1, idx+1)

        if config['type'] == 'line':
            ax.plot(config['x'], config['y'], linewidth=2, color='#14ffec')
        elif config['type'] == 'surface':
            pcm = ax.pcolormesh(config['x'], config['y'], config['z'],
                              cmap='jet', shading='auto')
            cbar = fig.colorbar(pcm, ax=ax)
            cbar.ax.tick_params(colors='#e0e0e0')

        ax.set_xlabel(config.get('xlabel', ''), fontsize=11)
        ax.set_ylabel(config.get('ylabel', ''), fontsize=11)
        ax.set_title(config.get('title', ''), fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.2, color='#e0e0e0')

        style_dark_axes(ax)

    fig.tight_layout()
    return fig_to_base64(fig)
