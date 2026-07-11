document.getElementById('start-btn').addEventListener('click', () => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.display = 'none';
        splash.remove(); 
    }
    try {
        init3DGame();
    } catch (err) {
        console.error("Initialization Failed:", err);
    }
});

function init3DGame() {
    let runs = 0;
    let wickets = 0;
    let totalFours = 0;
    let totalSixes = 0;

    let isSwinging = false;
    let swingTimer = 0;
    let batType = "ground"; 
    let ballState = "bowled"; 
    let ballVelocity = { x: 0, y: 0, z: 0 };
    
    let runningDirection = 0; 
    let runnerAnimTime = 0;
    let manualRunAvailable = false;
    let isBallProcessed = false; // Prevents double scoring or text glitches

    const scoreUI = document.getElementById('score-val');
    const wicketsUI = document.getElementById('wickets-val');
    const boundariesUI = document.getElementById('boundaries-val');
    const statusTextUI = document.getElementById('status-text');
    const popupUI = document.getElementById('action-popup');
    const runBtn = document.getElementById('run-btn');

    const canvasEl = document.getElementById('gameCanvas');
    
    // 3D Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3b7a2f); 

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5.0, 15.0); 
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const light = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(light);

    // Pitch
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 26), new THREE.MeshBasicMaterial({color: 0xe3ca96}));
    pitch.rotation.x = -Math.PI / 2;
    scene.add(pitch);

    // Stumps
    const stumpGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6);
    const stumpMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    function buildStumps(zPos) {
        for(let i = -1; i <= 1; i++) {
            const stump = new THREE.Mesh(stumpGeo, stumpMat);
            stump.position.set(i * 0.22, 0.6, zPos);
            scene.add(stump);
        }
    }
    buildStumps(-10); 
    buildStumps(9);   

    // Ball
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshBasicMaterial({ color: 0xcc1111 }));
    scene.add(ball);

    function resetBall() {
        if (runBtn) runBtn.style.display = 'none';
        manualRunAvailable = false;
        isBallProcessed = false; // Reset protection lock for the next delivery
        
        // Clear any old popups cleanly
        if (popupUI) popupUI.classList.remove('show');

        ball.position.set(0, 0.8, -10); 
        ballState = "bowled";
        
        const lengthMod = Math.random();
        ballVelocity.z = 0.26 + (lengthMod * 0.04); 
        ballVelocity.x = (Math.random() - 0.5) * 0.04; 
        ballVelocity.y = 0.025; 
        
        if (statusTextUI) {
            statusTextUI.innerText = lengthMod > 0.6 ? "BOWLER DELIVERS A SHORT BALL!" : "BOWLER RUNNING IN...";
        }
    }

    // Players Generator
    function createPlayer(jerseyColor, pantsColor, positionVec, isKeeper = false) {
        const group = new THREE.Group();
        
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.8, 8), new THREE.MeshBasicMaterial({color: jerseyColor}));
        torso.position.y = 0.75;
        group.add(torso);
        
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffdbac }));
        head.position.y = 1.25;
        group.add(head);

        const legMat = new THREE.MeshBasicMaterial({ color: pantsColor });
        const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.38, 6), legMat); 
        lLeg.position.set(-0.1, 0.19, 0);
        const rLeg = lLeg.clone(); 
        rLeg.position.x = 0.1;
        group.add(lLeg);
        group.add(rLeg);

        if (isKeeper) {
            torso.position.y = 0.55;
            head.position.y = 1.05;
            torso.rotation.x = Math.PI / 6;
        }

        group.userData = { leftLeg: lLeg, rightLeg: rLeg };
        group.position.copy(positionVec);
        scene.add(group);
        return group;
    }

        // Custom Player Colors for the TikTok Controversy Theme!
    // Batsman (Imran Khan / Qaidi 804) - Green Jersey, White Pants, Black Hair
    const batsman = createPlayer(0x117a1e, 0xffffff, new THREE.Vector3(0, 0, 8.0)); 
    
    // Bowler (Nawaz Sharif) - Sherwani Red/Orange Jersey, Dark Pants, Bald-ish look
    const bowler = createPlayer(0xd14d1d, 0x222222, new THREE.Vector3(0, 0, -10));
    
    // Keeper (Neutral Match Referee / Empire)
    const keeper = createPlayer(0x333333, 0xffffff, new THREE.Vector3(0, 0, 10.2), true);

    // Give them customized hair/caps to match their real-life personas!
    function addCustomLooks() {
        // 1. Give Kaptaan (Batsman) full thick black hair look
        const kaptaanHair = new THREE.Mesh(
            new THREE.SphereGeometry(0.23, 8, 8), 
            new THREE.MeshBasicMaterial({ color: 0x111111 })
        );
        kaptaanHair.position.set(0, 1.32, -0.02);
        batsman.add(kaptaanHair);

        // --- DYNAMIC LOGO GENERATOR FOR SHIRTS ---
        function createTextTexture(text, bgColor, textColor) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, 128, 128);
            
            ctx.fillStyle = textColor;
            ctx.font = "bold 50px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, 64, 64);
            
            return new THREE.CanvasTexture(canvas);
        }

        // 2. PUT "804" ON THE BATSMAN'S BACK (PTI Look)
        const ptiTexture = createTextTexture("804", "#117a1e", "#ffffff");
        const ptiBadge = new THREE.Mesh(
            new THREE.PlaneGeometry(0.35, 0.35),
            new THREE.MeshBasicMaterial({ map: ptiTexture, side: THREE.DoubleSide })
        );
        ptiBadge.position.set(0, 0.9, 0.28); 

        batsman.add(ptiBadge);

        // 3. Give the Bowler his iconic hairline
        const bowlerHair = new THREE.Mesh(
            new THREE.CylinderGeometry(0.21, 0.23, 0.1, 8), 
            new THREE.MeshBasicMaterial({ color: 0x332211 })
        );
        bowlerHair.position.set(0, 1.25, 0);
        bowler.add(bowlerHair);

        // 4. PUT "PML" BADGE ON THE BOWLER'S CHEST (Nawaz Look)
        const pmlnTexture = createTextTexture("PML", "#ffffff", "#008000");
        const pmlnBadge = new THREE.Mesh(
            new THREE.PlaneGeometry(0.3, 0.3),
            new THREE.MeshBasicMaterial({ map: pmlnTexture, side: THREE.DoubleSide })
        );
pmlnBadge.position.set(0, 0.75, 0.28); 
        pmlnBadge.rotation.y = 0;             
        bowler.add(pmlnBadge);
    }
          // --- ADDING CARTOON FACES ---
        const textureLoader = new THREE.TextureLoader();

        // Imran Khan Face
        textureLoader.load('ik_cartoon.png', function(texture) {
            const ikFace = new THREE.Mesh(
                new THREE.PlaneGeometry(0.5, 0.5),
                new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
            );
            ikFace.position.set(0, 1.25, 0.26);
            batsman.add(ikFace);
        });

        // Nawaz Sharif Face
        textureLoader.load('nawaz_cartoon.png', function(texture) {
            const nsFace = new THREE.Mesh(
                new THREE.PlaneGeometry(0.5, 0.5),
                new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
            );
nsFace.position.set(0, 1.25, 0.27); 
            nsFace.rotation.y = Math.PI;
            bowler.add(nsFace);
        });

    addCustomLooks();

    // Fielders
    const fielders = [
        createPlayer(0xcc3333, 0x111111, new THREE.Vector3(-6, 0, 2)),   
        createPlayer(0xcc3333, 0x111111, new THREE.Vector3(6, 0, 3)),    
        createPlayer(0xcc3333, 0x111111, new THREE.Vector3(-4, 0, -5)),  
        createPlayer(0xcc3333, 0x111111, new THREE.Vector3(4, 0, -6)),   
        createPlayer(0xcc3333, 0x111111, new THREE.Vector3(0, 0, -18))   
    ];

    // Bat
    const batRoot = new THREE.Group();
    batRoot.position.set(0.2, 0.8, 0.2);
    batsman.add(batRoot);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.8, 0.05), new THREE.MeshBasicMaterial({color: 0x9c6644}));
    blade.position.y = -0.4;
    batRoot.add(blade);
    
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), new THREE.MeshBasicMaterial({color: 0x222222}));
    handle.position.y = 0.05;
    batRoot.add(handle);

    batRoot.rotation.x = -Math.PI / 4;
    batRoot.rotation.z = Math.PI / 6;

    resetBall();

    function triggerShot(type) {
        if (!isSwinging && runningDirection === 0 && ballState === "bowled") {
            isSwinging = true;
            swingTimer = 0;
            batType = type;
        }
    }

    document.getElementById('btn-ground').addEventListener('click', () => triggerShot('ground'));
    document.getElementById('btn-loft').addEventListener('click', () => triggerShot('loft'));

    if (runBtn) {
        runBtn.addEventListener('click', () => {
            if (manualRunAvailable && runningDirection === 0) {
                runningDirection = 1; 
                runBtn.style.display = 'none';
                if (statusTextUI) statusTextUI.innerText = "RUNNING BETWEEN WICKETS!";
            }
        });
    }

    function showPopup(text) {
        if (!popupUI) return;
        popupUI.innerText = text;
        popupUI.classList.add('show');
    }

    // Animation / Physics Engine
    function animate() {
        requestAnimationFrame(animate);

        // Swing active logic
        if (isSwinging) {
            swingTimer += 0.38;
            batRoot.rotation.y = Math.sin(swingTimer) * -2.8;
            batRoot.rotation.x = Math.sin(swingTimer) * 1.3 - Math.PI/4;
            if (swingTimer >= Math.PI) { 
                isSwinging = false; 
                batRoot.rotation.y = 0; 
                batRoot.rotation.x = -Math.PI/4; 
            }
        }

        // Run mechanics
        if (runningDirection !== 0) {
            runnerAnimTime += 0.3;
            batsman.userData.leftLeg.position.y = 0.19 + Math.sin(runnerAnimTime) * 0.14;
            batsman.userData.rightLeg.position.y = 0.19 + Math.cos(runnerAnimTime) * 0.14;
            batsman.position.z -= runningDirection * 0.18; 

            if (runningDirection === 1 && batsman.position.z <= -3.0) {
                runningDirection = -1; 
                runs += 1;
                if (scoreUI) scoreUI.innerText = runs;
                if (statusTextUI) statusTextUI.innerText = "RUN SCORED! SPRINT BACK!";
            }
            if (runningDirection === -1 && batsman.position.z >= 8.0) {
                batsman.position.z = 8.0;
                runningDirection = 0;
                batsman.userData.leftLeg.position.y = 0.19;
                batsman.userData.rightLeg.position.y = 0.19;
                if (statusTextUI) statusTextUI.innerText = "SAFE IN THE CREASE.";
                setTimeout(resetBall, 1000);
            }
        }

        // Active ball tracking
        if (ballState === "bowled" && runningDirection === 0) {
            ball.position.z += ballVelocity.z;
            ball.position.x += ballVelocity.x;
            ball.position.y += ballVelocity.y;

            if (ball.position.y < 0.16) { 
                ball.position.y = 0.16; 
                ballVelocity.y = -ballVelocity.y * 0.75; 
            }

            // Bat Connection Window
            if (ball.position.z >= 7.2 && ball.position.z <= 8.4) {
                if (isSwinging && !isBallProcessed) {
                    isBallProcessed = true; // Lock scoring processing immediately
                    ballState = "hit";
                    const hitPower = Math.random();

                    if (batType === "loft") {
                        ballVelocity.z = -(hitPower * 0.32 + 0.25);
                        ballVelocity.x = (Math.random() - 0.5) * 0.7;
                        ballVelocity.y = hitPower * 0.4 + 0.25; 
                    } else {
                        ballVelocity.z = -(hitPower * 0.25 + 0.2);
                        ballVelocity.x = (Math.random() - 0.5) * 0.5;
                        ballVelocity.y = 0.02; 
                    }

                    // Process and lock exactly one score choice
                    if (batType === "loft" && hitPower > 0.65) {
                        runs += 6; totalSixes++;
                        scoreUI.innerText = runs;
                        boundariesUI.innerText = `${totalFours}/${totalSixes}`;
                        showPopup("SIX!! 🚀");
                        statusTextUI.innerText = "CRASHED OVER THE ROPE FOR A SIX!";
                        setTimeout(resetBall, 2500);
                    } else if (hitPower > 0.35) {
                        runs += 4; totalFours++;
                        scoreUI.innerText = runs;
                        boundariesUI.innerText = `${totalFours}/${totalSixes}`;
                        showPopup("FOUR! 🏏");
                        statusTextUI.innerText = "SMASHED FOR FOUR!";
                        setTimeout(resetBall, 2500);
                    } else {
                        showPopup("SHOT!");
                        statusTextUI.innerText = "SINGLE HIT! TAP RUN BUTTON!";
                        manualRunAvailable = true;
                        if (runBtn) runBtn.style.display = 'block';
                        setTimeout(() => { if(manualRunAvailable && runningDirection === 0) resetBall(); }, 4000);
                    }
                }
            }

            // Check if ball passed batsman cleanly
            if (ball.position.z > 9.2) {
                if (!isBallProcessed) {
                    isBallProcessed = true;
                    ballState = "missed";
                    wickets += 1;
                    if (wicketsUI) wicketsUI.innerText = wickets;
                    showPopup("OUT!! 🔴");
                    statusTextUI.innerText = "BOWLED OUT! THE STUMPS ARE SHATTERED!";
                    
                    setTimeout(() => {
                        if (wickets >= 10) {
                            statusTextUI.innerText = "ALL OUT! MATCH OVER!";
                            runs = 0; wickets = 0; totalFours = 0; totalSixes = 0;
                            scoreUI.innerText = "0"; wicketsUI.innerText = "0"; boundariesUI.innerText = "0/0";
                        }
                        resetBall();
                    }, 2500);
                }
            }
        } else if (ballState === "hit") {
            ball.position.z += ballVelocity.z;
            ball.position.x += ballVelocity.x;
            ball.position.y += ballVelocity.y;
            
            if (batType === "loft") ballVelocity.y -= 0.008; 
            if (ball.position.y < 0.16) {
                ball.position.y = 0.16;
                ballVelocity.y = 0;
                ballVelocity.z *= 0.98;
                ballVelocity.x *= 0.98;
            }
        }

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
window.addEventListener('load', () => {
    const bgMusic = document.getElementById('bgMusic');
    
    function playMusic() {
        if (bgMusic) {
            bgMusic.play().catch(error => console.log("Waiting for interaction"));
        }
        document.removeEventListener('click', playMusic);
    }

    document.addEventListener('click', playMusic);
});
