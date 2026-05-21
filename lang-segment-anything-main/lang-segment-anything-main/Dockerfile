# syntax=docker/dockerfile:1.4

FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

# Proxy args for docker build only
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV GRADIO_SERVER_NAME="0.0.0.0"

# pip mirror and timeout settings
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ENV PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cu124
ENV PIP_DEFAULT_TIMEOUT=120
ENV PIP_RETRIES=3

# Use faster apt sources
RUN sed -i 's|http://archive.ubuntu.com/ubuntu/|https://mirrors.aliyun.com/ubuntu/|g' /etc/apt/sources.list && \
    sed -i 's|http://security.ubuntu.com/ubuntu/|https://mirrors.aliyun.com/ubuntu/|g' /etc/apt/sources.list

# Install necessary packages
RUN export HTTP_PROXY="${HTTP_PROXY}" HTTPS_PROXY="${HTTPS_PROXY}" \
           http_proxy="${HTTP_PROXY}" https_proxy="${HTTPS_PROXY}" \
           NO_PROXY="${NO_PROXY}" no_proxy="${NO_PROXY}" && \
    apt-get -o Acquire::Retries=3 update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-dev \
    python3-pip \
    openssh-client \
    build-essential \
    git \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Make GitHub fetching more tolerant
RUN git config --global http.lowSpeedLimit 1000 && \
    git config --global http.lowSpeedTime 120 && \
    git config --global http.postBuffer 524288000

WORKDIR /lang-segment-anything

# Copy requirements first for better cache reuse
COPY requirements.txt /lang-segment-anything/requirements.txt

# Upgrade pip and install dependencies
RUN --mount=type=cache,target=/root/.cache/pip \
    export HTTP_PROXY="${HTTP_PROXY}" HTTPS_PROXY="${HTTPS_PROXY}" \
           http_proxy="${HTTP_PROXY}" https_proxy="${HTTPS_PROXY}" \
           NO_PROXY="${NO_PROXY}" no_proxy="${NO_PROXY}" && \
    python3 -m pip install --upgrade pip && \
    pip install \
    -v \
    --retries 3 \
    --timeout 120 \
    -r requirements.txt

# Copy project files
COPY . /lang-segment-anything

EXPOSE 8000

CMD ["python3", "app.py"]